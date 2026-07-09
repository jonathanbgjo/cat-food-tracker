import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";

// Whisker (Litter-Robot / Feeder-Robot) has no official public API. These are
// the community-reverse-engineered endpoints used by pylitterbot. They can
// break at any time — treat failures as non-fatal.
const USER_POOL_ID = "us-east-1_rjhNnZVAm";
const CLIENT_ID = "4552ujeu3aic90nf8qn53levmn";
const PET_PROFILE_URL = "https://pet-profile.iothings.site/graphql/";

const LB_TO_G = 453.59237;

export type WeightReading = { grams: number; timestamp: string };
export type WhiskerPet = {
  petId: string;
  name: string;
  currentGrams: number | null;
  history: WeightReading[];
};

// SRP login against the Whisker Cognito user pool. Returns the raw id token.
function authenticate(email: string, password: string): Promise<string> {
  const pool = new CognitoUserPool({
    UserPoolId: USER_POOL_ID,
    ClientId: CLIENT_ID,
  });
  const user = new CognitoUser({ Username: email, Pool: pool });
  const details = new AuthenticationDetails({
    Username: email,
    Password: password,
  });

  return new Promise((resolve, reject) => {
    user.authenticateUser(details, {
      onSuccess: (session) => resolve(session.getIdToken().getJwtToken()),
      onFailure: (err) => reject(err),
      newPasswordRequired: () =>
        reject(new Error("Whisker account requires a new password")),
    });
  });
}

// The user id Whisker keys pets on lives in the id token's `mid` claim.
function userIdFromToken(idToken: string): string {
  const payload = idToken.split(".")[1];
  const json = Buffer.from(payload, "base64").toString("utf8");
  const claims = JSON.parse(json);
  if (!claims.mid) throw new Error("No `mid` claim in Whisker id token");
  return claims.mid as string;
}

async function graphql<T>(
  idToken: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const res = await fetch(PET_PROFILE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Whisker GraphQL ${res.status}: ${await res.text()}`);
  }
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(`Whisker GraphQL error: ${JSON.stringify(body.errors)}`);
  }
  return body.data as T;
}

const PETS_QUERY = `
  query GetPetsByUser($userId: String!) {
    getPetsByUser(userId: $userId) {
      petId
      name
      weight
      weightHistory {
        weight
        timestamp
      }
    }
  }`;

type RawPet = {
  petId: string;
  name: string;
  weight: number | null;
  weightHistory: { weight: number; timestamp: string }[] | null;
};

const lbToGrams = (lb: number) => Math.round(lb * LB_TO_G);

// Log in and pull every pet with its weight history (weights converted to grams).
export async function fetchWhiskerPets(
  email: string,
  password: string
): Promise<WhiskerPet[]> {
  const idToken = await authenticate(email, password);
  const userId = userIdFromToken(idToken);

  const data = await graphql<{ getPetsByUser: RawPet[] }>(idToken, PETS_QUERY, {
    userId,
  });

  return (data.getPetsByUser ?? []).map((p) => ({
    petId: p.petId,
    name: p.name,
    currentGrams: p.weight != null ? lbToGrams(p.weight) : null,
    history: (p.weightHistory ?? [])
      .filter((w) => w.weight != null && w.timestamp)
      .map((w) => ({ grams: lbToGrams(w.weight), timestamp: w.timestamp })),
  }));
}
