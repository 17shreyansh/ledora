import { ROLE_DESCRIPTIONS, ROLE_LABELS, type MemberDto, type OrgRole } from '@ledora/shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import { useId, useState, type FormEvent } from 'react';
import { useUpdateMemberRole } from '../../api/organizations';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { useNotify } from '../../components/NotifyProvider';
import { purple, slate } from '../../theme/tokens';
import { memberErrorTitle } from './memberErrors';

export function ChangeRoleDialog({
  member,
  orgId,
  roles,
  isSelf,
  onClose,
}: {
  member: MemberDto;
  orgId: string;
  roles: OrgRole[];
  isSelf: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const notify = useNotify();
  const [role, setRole] = useState<OrgRole>(member.role);
  const update = useUpdateMemberRole(orgId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (role === member.role) return;
    update.mutate(
      { userId: member.userId, role },
      {
        onSuccess: () => {
          notify(isSelf ? `Your role is now ${ROLE_LABELS[role]}` : `${member.name} is now ${ROLE_LABELS[role]}`);
          onClose();
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={update.isPending ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby={titleId}
      slotProps={{ paper: { component: 'form', onSubmit: submit, noValidate: true } as object }}
    >
      <DialogTitle id={titleId}>{isSelf ? 'Change your role' : `Change role for ${member.name}`}</DialogTitle>
      <DialogContent>
        {isSelf ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Stepping down takes effect immediately. An organization always needs at least one owner.
          </Typography>
        ) : null}
        {update.error ? <ApiErrorAlert error={update.error} title={memberErrorTitle(update.error)} sx={{ mb: 4 }} /> : null}
        <RadioGroup
          aria-labelledby={titleId}
          value={role}
          onChange={(e) => setRole(e.target.value as OrgRole)}
          sx={{ display: 'grid', gap: 2 }}
        >
          {roles.map((r) => {
            const selected = r === role;
            return (
              <Box
                key={r}
                component="label"
                sx={{
                  display: 'flex',
                  gap: 2,
                  alignItems: 'flex-start',
                  p: 3,
                  borderRadius: '8px',
                  border: 1,
                  borderColor: selected ? purple[300] : 'divider',
                  bgcolor: selected ? purple[50] : 'background.paper',
                  cursor: 'pointer',
                  '&:hover': { borderColor: selected ? purple[300] : slate[300] },
                }}
              >
                <Radio value={r} sx={{ p: 0.5, mt: -0.25 }} />
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                    {ROLE_LABELS[r]}
                    {r === member.role ? (
                      <Box component="span" sx={{ ml: 1.5, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>
                        Current
                      </Box>
                    ) : null}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {ROLE_DESCRIPTIONS[r]}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="neutral" onClick={onClose} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={update.isPending} disabled={role === member.role}>
          Save role
        </Button>
      </DialogActions>
    </Dialog>
  );
}
