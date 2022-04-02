import { query as q } from 'faunadb'

import NextAuth from "next-auth"
import GithubProvider from "next-auth/providers/github"

import { fauna } from '../../../services/fauna'

export default NextAuth({
    providers: [
        GithubProvider({
            clientId: process.env.GITHUB_CLIENTE_ID,
            clientSecret: process.env.GITHUB_CLIENTE_SECRETE,
            authorization: {
                params: {
                    scope: 'read:user, user:email'
                }
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile, email, credentials }) {
            const Email = user.email
            try {
                await fauna.query(
                    q.If(
                        q.Not(
                            q.Exists(
                                q.Match(
                                    q.Index('user_by_email'),
                                    q.Casefold(Email)
                                )
                            )
                        ),
                        q.Create(
                            q.Collection('users'),
                            { data: { Email } }
                        ),
                        q.Get(
                            q.Match(
                                q.Index('user_by_email'),
                                q.Casefold(Email)
                            )
                        )
                    )
                )

                return true
            } catch {
                return false
            }
        },
    },
})