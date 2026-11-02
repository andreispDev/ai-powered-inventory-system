import { createAuthClient } from "better-auth/react";

const client = createAuthClient();

export const signInWithGoogle = () =>
  client.signIn.social({ provider: "google", callbackURL: "/dashboard", errorCallbackURL: "/access-denied" });

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
