import type { Metadata } from "next";
import { AuthForm, type AuthFormValues } from "@/components/auth-form";
import { validateRegister } from "@/lib/auth/validation";

export const metadata: Metadata = {
  title: "Kawan — Chat AI by tokengateway.ai.id",
  description: "Buat akun Kawan dengan email dan kata sandi.",
};

export default function DaftarPage() {
  // Server Action: memakai `validateRegister` apa adanya, sehingga aturan
  // panjang kata sandi dan kecocokan konfirmasi tetap satu sumber kebenaran.
  async function validate(values: AuthFormValues) {
    "use server";
    return validateRegister({
      email: values.email,
      name: values.name === "" ? undefined : values.name,
      password: values.password,
      confirmPassword: values.confirmPassword,
    });
  }

  return <AuthForm mode="register" onValidate={validate} />;
}
