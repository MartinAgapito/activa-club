import { Amplify } from 'aws-amplify'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string,
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN as string,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [`${window.location.origin}/auth/callback`],
          redirectSignOut: [`${window.location.origin}/auth/login`],
          responseType: 'code',
        },
      },
    },
  },
})
