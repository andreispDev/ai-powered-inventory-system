import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

const client = createAuthClient({ plugins: [emailOTPClient()] });

export const requestSignInCode = (email: string) =>
  client.emailOtp.sendVerificationOtp({ email, type: "sign-in" });

export const signInWithCode = (email: string, otp: string) => client.signIn.emailOtp({ email, otp });

export const signOut = () =>
  client.signOut({
    fetchOptions: {
      onSuccess: () => {
        // A full reload clears everything held for the signed-in user.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      },
    },
  });
