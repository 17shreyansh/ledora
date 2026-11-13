import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { errorResponse, mockApi, renderRoutes } from '../../test/utils';
import { PublicOnly } from '../../auth/guards';
import { LoginPage } from './LoginPage';

function renderLogin() {
  return renderRoutes([{ element: <PublicOnly />, children: [{ path: '/login', element: <LoginPage /> }] }], '/login');
}

describe('LoginPage', () => {
  it('shows validation messages for empty input without calling the API', async () => {
    const { requests } = mockApi({
      'GET /auth/session': () => errorResponse(401, 'UNAUTHENTICATED', 'Sign in to continue'),
    });
    renderLogin();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(requests.filter((r) => r.path === '/auth/login')).toHaveLength(0);
  });

  it('shows a message for an invalid email address', async () => {
    const { requests } = mockApi({
      'GET /auth/session': () => errorResponse(401, 'UNAUTHENTICATED', 'Sign in to continue'),
    });
    renderLogin();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'whatever');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.queryByText('Enter your password')).not.toBeInTheDocument();
    expect(requests.filter((r) => r.path === '/auth/login')).toHaveLength(0);
  });

  it('shows the API message when credentials are wrong', async () => {
    mockApi({
      'GET /auth/session': () => errorResponse(401, 'UNAUTHENTICATED', 'Sign in to continue'),
      'POST /auth/login': () => errorResponse(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect'),
    });
    renderLogin();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email or password is incorrect');
    expect(alert).toHaveTextContent('Request ID: req-test-1');
  });
});
