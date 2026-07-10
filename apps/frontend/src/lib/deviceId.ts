// Anonymous identity for chat history, until Clerk auth ships.
// One UUID per browser, persisted in localStorage. When real accounts
// arrive, the backend can claim these sessions by matching device_id
// at login time (see database/schema.sql's account_id column notes) —
// nothing here needs to change for that to work.

const STORAGE_KEY = "travelmaster:device_id";

export function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEY);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }

  return id;
}
