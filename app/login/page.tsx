"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Label } from "@/src/components/ui/label";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import { Wallet } from "lucide-react";
import { initUser } from "@/app/user.actions";
import { useRouter } from "next/navigation";

export default function Login() {
  const [name, setName] = useState<string>("");
  const router = useRouter();

  const login = async () => {
    await initUser({ name });
    router.replace("/");
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center">
      <div>
        <Card className="w-[450px]">
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>
              Set a user name to personalize the app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form>
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="name">Name</Label>

                  <Input
                    id="name"
                    placeholder="Your name"
                    // @ts-ignore
                    onInput={(e) => setName(e.target.value)}
                    value={name}
                  />
                </div>
              </div>
            </form>
            <Alert className="mt-5" variant="default">
              <Wallet className="h-4 w-4" />
              <AlertTitle>Data is yours!</AlertTitle>
              <AlertDescription>
                All banking data never lets your device and is stored securely
                in your file system
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={login} disabled={!name}>
              Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
