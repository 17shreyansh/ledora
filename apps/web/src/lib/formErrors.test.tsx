import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { RegisterPage } from '../features/auth/RegisterPage';
import { errorResponse, mockApi, renderPage } from '../test/utils';
import { applyApiFieldErrors, hasFieldErrors } from './formErrors';

function Harness({ error }: { error: unknown }) {
  const { register, setError, formState } = useForm({ defaultValues: { email: '', name: '' } });
  const [applied, setApplied] = useState<boolean | null>(null);
  return (
    <form>
      <input aria-label="email" {...register('email')} />
      {formState.errors.email ? <p>email: {formState.errors.email.message}</p> : null}
      <input aria-label="name" {...register('name')} />
      {formState.errors.name ? <p>name: {formState.errors.name.message}</p> : null}
      <button type="button" onClick={() => setApplied(applyApiFieldErrors(error, setError, ['email', 'name']))}>
        apply
      </button>
      {applied !== null ? <p>applied: {String(applied)}</p> : null}
    </form>
  );
}

describe('API field errors → form fields', () => {
  it('maps known field paths onto react-hook-form fields and ignores unknown ones', async () => {
    const error = new ApiError({
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Some fields need attention',
      fields: { email: 'Enter a valid email address', 'nested.thing': 'ignored' },
    });
    render(<Harness error={error} />);
    await userEvent.click(screen.getByRole('button', { name: 'apply' }));
    expect(screen.getByText('email: Enter a valid email address')).toBeInTheDocument();
    expect(screen.queryByText(/name:/)).not.toBeInTheDocument();
    expect(screen.getByText('applied: true')).toBeInTheDocument();
    expect(hasFieldErrors(error, ['email'])).toBe(true);
    expect(hasFieldErrors(error, ['name'])).toBe(false);
  });

  it('returns false for errors without field details', async () => {
    render(<Harness error={new ApiError({ status: 500, code: 'INTERNAL', message: 'boom' })} />);
    await userEvent.click(screen.getByRole('button', { name: 'apply' }));
    expect(screen.getByText('applied: false')).toBeInTheDocument();
  });

  it('shows a CONFLICT field error from the API inline on the register form', async () => {
    mockApi({
      'GET /auth/session': () => errorResponse(401, 'UNAUTHENTICATED', 'Sign in to continue'),
      'POST /auth/register': () =>
        errorResponse(409, 'CONFLICT', 'An account with this email already exists', {
          email: 'An account with this email already exists. Sign in instead.',
        }),
    });
    renderPage(<RegisterPage />, '/register');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Full name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Work email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'a long enough password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const message = await screen.findByText('An account with this email already exists. Sign in instead.');
    // Rendered as the email field's helper text, and the field is marked invalid.
    const email = screen.getByLabelText('Work email');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email.getAttribute('aria-describedby')).toBe(message.id);
    // No duplicate form-level alert when the error is shown inline.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
