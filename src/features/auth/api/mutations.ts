import { useMutation } from '@tanstack/react-query'
import {
  type ActivationFormValues,
  activationResponseSchema,
  type LoginFormValues,
} from '@/features/auth/api/schema'
import { sessionKeys } from '@/features/auth/api/session'
import { usernameToEmail } from '@/features/auth/lib/credentials'
import { invokeEdgeFunction } from '@/shared/lib/bff'
import { queryClient } from '@/shared/lib/query-client'
import { supabase } from '@/shared/lib/supabase'
import type { AppError } from '@/shared/types/errors'

export function useSignIn() {
  return useMutation<void, AppError, LoginFormValues>({
    mutationFn: async ({ username, password }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      })
      if (error) {
        throw error.status === 400
          ? { kind: 'business', code: 'INVALID_CREDENTIALS', message: error.message }
          : { kind: 'network', message: error.message }
      }
      queryClient.setQueryData(sessionKeys.session, data.session)
    },
  })
}

export function useSignOut() {
  return useMutation<void, AppError>({
    mutationFn: async () => {
      await supabase.auth.signOut()
      queryClient.clear()
    },
  })
}

export function useActivateAccount() {
  return useMutation<void, AppError, ActivationFormValues>({
    mutationFn: async ({ username, code, password }) => {
      const result = await invokeEdgeFunction('activate-account', activationResponseSchema, {
        username,
        code,
        password,
      })
      if (!result.ok) throw result.error
    },
  })
}
