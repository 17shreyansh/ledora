import { lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { PublicOnly, RequireAuth, RequireVerified } from './auth/guards';
import { RootRedirect } from './auth/RootRedirect';
import { AppShell } from './components/AppShell';
import { NotFoundPage } from './components/NotFoundPage';
import { AuthLayout } from './features/auth/AuthLayout';
import { LoginPage } from './features/auth/LoginPage';
import { OrgLayout } from './features/organizations/OrgLayout';

// Sign-in is the most common entry point, so it ships in the main bundle; everything else loads on demand.
const RegisterPage = lazy(() => import('./features/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./features/auth/VerifyEmailPage'));
const CheckEmailPage = lazy(() => import('./features/auth/CheckEmailPage'));
const AcceptInvitationPage = lazy(() => import('./features/invitations/AcceptInvitationPage'));
const CreateOrganizationPage = lazy(() => import('./features/onboarding/CreateOrganizationPage'));
const OverviewPage = lazy(() => import('./features/organizations/OverviewPage'));
const SettingsPage = lazy(() => import('./features/organizations/SettingsPage'));
const WebsitesPage = lazy(() => import('./features/websites/WebsitesPage'));
const WebsiteDetailPage = lazy(() => import('./features/websites/WebsiteDetailPage'));
const MembersPage = lazy(() => import('./features/members/MembersPage'));
const ActivityPage = lazy(() => import('./features/activity/ActivityPage'));
const AccountPage = lazy(() => import('./features/account/AccountPage'));

export const routes: RouteObject[] = [
  { path: '/', element: <RootRedirect /> },
  {
    element: <AuthLayout />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
          { path: 'reset-password', element: <ResetPasswordPage /> },
        ],
      },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      { path: 'invitations/accept', element: <AcceptInvitationPage /> },
      { element: <RequireAuth />, children: [{ path: 'check-email', element: <CheckEmailPage /> }] },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireVerified />,
        children: [{ path: 'onboarding/organization', element: <CreateOrganizationPage /> }],
      },
      {
        element: <AppShell />,
        children: [
          { path: 'account', element: <AccountPage /> },
          {
            path: 'o/:orgId',
            element: <OrgLayout />,
            children: [
              { index: true, element: <OverviewPage /> },
              { path: 'websites', element: <WebsitesPage /> },
              { path: 'websites/:websiteId/:tab?', element: <WebsiteDetailPage /> },
              { path: 'members', element: <MembersPage /> },
              { path: 'activity', element: <ActivityPage /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
