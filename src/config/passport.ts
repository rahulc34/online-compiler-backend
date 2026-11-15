import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { config } from "./index";
import User from "../models/user.model";

const { clientId, clientSecret, callbackUrl } = config.google;

const isGoogleConfigured = Boolean(clientId && clientSecret && callbackUrl);

if ((clientId || clientSecret || callbackUrl) && !isGoogleConfigured) {
  throw new Error("Google OAuth configuration is incomplete");
}

if (isGoogleConfigured) {
  passport.use(
    "google",
    new GoogleStrategy(
      {
        clientID: clientId!,
        clientSecret: clientSecret!,
        callbackURL: callbackUrl!,
        state: true,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const verifiedEmail = profile.emails?.find(
            (email) => email.verified === true,
          )?.value;

          if (!verifiedEmail) {
            return done(null, false);
          }

          const email = verifiedEmail.toLowerCase();

          // Check whether this Google account already exists.
          let user = await User.findOne({
            googleId: profile.id,
          });

          if (!user) {
            // Link an existing account with the verified Google email.
            user = await User.findOne({ email });

            if (user) {
              user.googleId = profile.id;
              user.isEmailVerified = true;
              user.emailVerifiedAt = new Date();
              await user.save();
            } else {
              // Create a new Google-authenticated account.
              user = await User.create({
                name: profile.displayName || email.split("@")[0],
                email,
                googleId: profile.id,
                isEmailVerified: true,
                emailVerifiedAt: new Date(),
              });
            }
          }

          if (user.status === "banned") {
            return done(null, false);
          }

          return done(null, user);
        } catch (error) {
          return done(
            error instanceof Error
              ? error
              : new Error("Google authentication failed"),
          );
        }
      },
    ),
  );
}

export default passport;
