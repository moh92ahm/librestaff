import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/db'
import { usersTable } from '@/db/schema'
import { or, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { normalizeLoginIdentifier, normalizeLoginIdentifierLegacy } from '@/lib/usernames'
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit'

function normalizedStoredUsernameExpression() {
  return sql`regexp_replace(
    lower(
      translate(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(${usersTable.username}, 'ß', 'ss'),
                  'ẞ',
                  'SS'
                ),
                'æ',
                'ae'
              ),
              'Æ',
              'AE'
            ),
            'œ',
            'oe'
          ),
          'Œ',
          'OE'
        ),
        'ÁÀÂÄÃÅĀĂĄĆĈČÇĎĐÉÈÊËĒĖĘĞĜĢĠÍÌÎÏĪĮİŁŃÑÓÒÔÖÕŌŐØŘŚŞŠŤȚÚÙÛÜŪŮŰÝŸŹŻŽáàâäãåāăąćĉčçďđéèêëēėęğĝģġíìîïīįıłńñóòôöõōőøřśşšťțúùûüūůűýÿźżž',
        'AAAAAAAAACCCCDDEEEEEEEGGGGIIIIIIILNNOOOOOOOORSSSTTUUUUUUUYYZZZaaaaaaaaaccccddeeeeeeeggggiiiiiiilnnoooooooorsssttuuuuuuuyyzzz'
      )
    ),
    '[^a-z0-9._-]',
    '',
    'g'
  )`
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const identifier = normalizeLoginIdentifier(credentials.email)
        const legacyIdentifier = normalizeLoginIdentifierLegacy(credentials.email)
        const ip = request ? getClientIp(request as Request) : 'unknown'
        const limit = await consumeRateLimit({
          scope: 'login',
          key: `${ip}:${identifier}`,
          limit: 10,
          windowMs: 15 * 60 * 1000,
        })

        if (!limit.allowed) {
          return null
        }

        // Support both email and username login
        const user = await db.query.usersTable.findFirst({
          where: or(
            sql`lower(${usersTable.email}) = ${identifier}`,
            sql`lower(${usersTable.username}) = ${identifier}`,
            sql`${normalizedStoredUsernameExpression()} = ${identifier}`,
            sql`lower(${usersTable.username}) = ${legacyIdentifier}`,
          ),
          with: {
            role: true,
            department: true,
            managedDepartments: true,
          },
        })

        if (!user || !user.password || !user.isActive || user.role?.isActive === false) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(credentials.password as string, user.password)

        if (!isPasswordValid) {
          return null
        }

        // Don't send password to client
        const { password, ...userWithoutPassword } = user

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          image: user.photo,
          language: user.language,
          theme: user.theme,
          isActive: user.isActive,
          isProtectedAdmin: user.isProtectedAdmin,
          role: user.role,
          departmentId: user.departmentId,
          department: user.department,
          managedDepartments: user.managedDepartments,
        } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.language = (user as any).language
        token.theme = (user as any).theme
        token.isActive = (user as any).isActive
        token.isProtectedAdmin = (user as any).isProtectedAdmin
        token.role = (user as any).role
        token.departmentId = (user as any).departmentId
        token.department = (user as any).department
        token.managedDepartments = (user as any).managedDepartments
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        ;(session.user as any).language = token.language
        ;(session.user as any).theme = token.theme
        ;(session.user as any).isActive = token.isActive
        ;(session.user as any).isProtectedAdmin = token.isProtectedAdmin
        ;(session.user as any).role = token.role
        ;(session.user as any).departmentId = token.departmentId
        ;(session.user as any).department = token.department
        ;(session.user as any).managedDepartments = token.managedDepartments
      }
      return session
    },
  },
})
