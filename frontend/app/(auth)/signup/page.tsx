import { redirect } from "next/navigation";

export default function SignupPage() {
  // OAuth-only auth — signing up and logging in are the same flow.
  redirect("/login");
}
