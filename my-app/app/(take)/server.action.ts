"use server";

import { redirect } from "next/navigation";

export async function submitForm(formData: FormData) {
//   const name = formData.get("name");
//   const email = formData.get("email");
//   const content = formData.get("content");
const {name,email,content}= Object.fromEntries(formData.entries());
  console.log({ name, email, content });

  // Example DB write
  // await prisma.message.create({ data: { name, email, content } })

//   redirect("/success");
}
