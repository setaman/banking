"use client";

import * as React from "react";
import { User } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { getUser, initUser, updateUser } from "@/app/user.actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { UserI } from "@/src/types";

export function UserNavItem() {
  const [user, setUser] = useState<UserI | null>();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    const loadUser = async () => {
      // await initUser();
      const user = await getUser();
      setUser(user);
      setName(user?.name ?? "");
    };
    loadUser();
  }, []);

  const changeUserName = () => {
    updateUser({ name }).then(() => {
      setUser({ ...(user as UserI), name });
    });
  };

  return (
    <>
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <User size="small" color="indigo" />
              <span className="ml-2">{user.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Card className="w-[350px]">
              <CardHeader>
                <CardTitle>{user.name}</CardTitle>
                <CardDescription>
                  This is a sample User. You can change user name to personalize
                  the app a bit
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form>
                  <div className="grid w-full items-center gap-4">
                    <div className="flex flex-col space-y-1.5">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="Name of your project"
                        onInput={(e) => setName(e.target.value)}
                        value={name}
                      />
                    </div>
                  </div>
                </form>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button onClick={changeUserName}>Save</Button>
              </CardFooter>
            </Card>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
