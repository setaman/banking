"use server";

import { faker } from "@faker-js/faker";
import { UserI } from "@/src/types";
import { User } from "@/db/db";

let user: UserI | null = null;

const createNewUser = (): UserI => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
});

export const initUser = async ({ name }: { name: string }) => {
  user = createNewUser();
  user.name = name;
  new User().set(user);
};

export const getUser = async () => {
  return new User().get();
};
export const updateUser = async ({ name }: { name: string }) => {
  user = { ...(user as UserI), name };
  new User().set(user);
};
