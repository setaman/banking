"use client";

import { uploadCsvExport } from "@/app/upload.actions";
import { Institution } from "@/src/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";

import { Button } from "@/src/components/ui/button";
import { useState } from "react";
import Link from "next/link";
import { Link as LinkIcon } from "lucide-react";

export default function Upload() {
  const [id, setId] = useState("");
  async function uploadFile(formData: FormData) {
    const resId = await uploadCsvExport(formData, Institution.DKB);
    setId(resId);
  }

  return (
    <div className="w-full mt-28 flex items-center justify-center">
      {!id && (
        <div>
          <form action={uploadFile} className="">
            <Card className="w-[450px]">
              <CardHeader>
                <CardTitle>Upload CSV file</CardTitle>
                <CardDescription>
                  Set a user name to personalize the app
                </CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  name="file"
                  className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
                  id="default_size"
                  type="file"
                />
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button type="submit">Submit</Button>
              </CardFooter>
            </Card>
          </form>
        </div>
      )}
      {id && (
        <Card className="w-[450px]">
          <CardHeader>
            <CardTitle>Your stats are ready</CardTitle>
            <CardDescription>
              With this link you can access generated stats any time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/upload/${id}`} legacyBehavior passHref>
              <Button style={{ width: "100%" }}>
                <LinkIcon />
                <span className="ml-2">Open link</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
