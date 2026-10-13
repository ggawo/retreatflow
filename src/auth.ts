import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "./lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        // 1. Check default admin credentials
        if (credentials.email === "admin@retreatflow.com" && credentials.password === "password") {
          return { id: "1", name: "Admin User", email: "admin@retreatflow.com", role: "ADMIN" };
        }

        // 2. Check database for registered admin user
        try {
          const user = await prisma.user.findUnique({
            where: { email: String(credentials.email) },
          });

          if (user && user.password === String(credentials.password)) {
            return {
              id: user.id,
              name: user.name || "Admin",
              email: user.email,
              role: user.role || "ADMIN",
            };
          }
        } catch (err) {
          console.error("Auth DB check error:", err);
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        if (token.email) session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
