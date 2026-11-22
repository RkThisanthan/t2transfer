import bcrypt from "bcryptjs";

// P1-AUTH-01: passwords are only ever stored as bcrypt hashes.
const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Used when the username does not exist, so a wrong username takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("t2t-timing-guard", COST);
export async function verifyAgainstDummy(plain: string): Promise<false> {
  await bcrypt.compare(plain, DUMMY_HASH);
  return false;
}
