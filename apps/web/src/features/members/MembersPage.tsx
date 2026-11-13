import { canManageMember, hasPermission, type InvitationDto, type MemberDto, type OrgRole } from '@ledora/shared';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import ManageAccountsOutlined from '@mui/icons-material/ManageAccountsOutlined';
import MarkEmailUnreadOutlined from '@mui/icons-material/MarkEmailUnreadOutlined';
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined';
import PersonAddAltOutlined from '@mui/icons-material/PersonAddAltOutlined';
import PersonRemoveOutlined from '@mui/icons-material/PersonRemoveOutlined';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useSession } from '../../api/auth';
import { queryKeys } from '../../api/queryKeys';
import { useInvitations, useLeaveOrganization, useMembers, useRemoveMember, useRevokeInvitation } from '../../api/organizations';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { useNotify } from '../../components/NotifyProvider';
import { PageHeader } from '../../components/PageHeader';
import { RoleChip } from '../../components/RoleChip';
import { SectionCard } from '../../components/SectionCard';
import { clearLastOrgId } from '../../lib/lastOrg';
import { formatDate, initials } from '../../lib/format';
import { useCurrentOrg } from '../organizations/OrgContext';
import { ChangeRoleDialog } from './ChangeRoleDialog';
import { grantableRoles, InviteDialog } from './InviteDialog';
import { memberErrorTitle } from './memberErrors';
import { visuallyHidden } from '../../lib/a11y';

type Dialog =
  | { kind: 'role'; member: MemberDto }
  | { kind: 'remove'; member: MemberDto }
  | { kind: 'leave' }
  | { kind: 'revoke'; invitation: InvitationDto }
  | null;

interface MemberActions {
  changeRole: boolean;
  remove: boolean;
  leave: boolean;
}

/** What the viewer may do to a row. UI only — the server enforces the same rules. */
function actionsFor(myRole: OrgRole, member: MemberDto, isSelf: boolean): MemberActions {
  if (isSelf) return { changeRole: myRole === 'owner', remove: false, leave: true };
  const manage = hasPermission(myRole, 'members.manage') && canManageMember(myRole, member.role);
  return { changeRole: manage && grantableRoles(myRole).length > 0, remove: manage, leave: false };
}

function RowActions({
  member,
  actions,
  onSelect,
}: {
  member: MemberDto;
  actions: MemberActions;
  onSelect: (kind: 'role' | 'remove' | 'leave') => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!actions.changeRole && !actions.remove && !actions.leave) return null;
  const pick = (kind: 'role' | 'remove' | 'leave') => {
    setAnchor(null);
    onSelect(kind);
  };
  return (
    <>
      <IconButton size="small" aria-label={`Actions for ${member.name}`} aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)}>
        <MoreHorizOutlined fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {actions.changeRole ? (
          <MenuItem onClick={() => pick('role')}>
            <ListItemIcon>
              <ManageAccountsOutlined />
            </ListItemIcon>
            {actions.leave ? 'Change my role' : 'Change role'}
          </MenuItem>
        ) : null}
        {actions.changeRole && (actions.remove || actions.leave) ? <Divider sx={{ my: 1 }} /> : null}
        {actions.remove ? (
          <MenuItem onClick={() => pick('remove')} sx={{ color: 'error.main', '& .MuiListItemIcon-root': { color: 'error.main' } }}>
            <ListItemIcon>
              <PersonRemoveOutlined />
            </ListItemIcon>
            Remove from organization
          </MenuItem>
        ) : null}
        {actions.leave ? (
          <MenuItem onClick={() => pick('leave')} sx={{ color: 'error.main', '& .MuiListItemIcon-root': { color: 'error.main' } }}>
            <ListItemIcon>
              <LogoutOutlined />
            </ListItemIcon>
            Leave organization
          </MenuItem>
        ) : null}
      </Menu>
    </>
  );
}

function TableSkeleton({ rows = 3, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <TableRow key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <TableCell key={c}>
              <Skeleton variant="text" width={c === 0 ? '60%' : '40%'} height={20} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function MembersPage() {
  const { org, role: myRole, can } = useCurrentOrg();
  const session = useSession();
  const myId = session.data?.user.id ?? '';
  const canInvite = can('members.invite');
  const members = useMembers(org.id);
  const invitations = useInvitations(org.id, canInvite);
  const removeMember = useRemoveMember(org.id);
  const leave = useLeaveOrganization(org.id);
  const revoke = useRevokeInvitation(org.id);
  const notify = useNotify();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState<Dialog>(null);
  const inviteOpen = canInvite && params.get('invite') === '1';

  const setInviteOpen = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set('invite', '1');
    else next.delete('invite');
    setParams(next, { replace: true });
  };

  const closeDialog = () => {
    setDialog(null);
    removeMember.reset();
    leave.reset();
    revoke.reset();
  };

  const items = members.data?.pages.flatMap((p) => p.items) ?? [];
  const roles = grantableRoles(myRole);

  return (
    <>
      <PageHeader
        title="Members"
        description="People who can access this organization and what each of them can do."
        actions={
          canInvite ? (
            <Button variant="contained" startIcon={<PersonAddAltOutlined />} onClick={() => setInviteOpen(true)}>
              Invite member
            </Button>
          ) : undefined
        }
      />

      <Box sx={{ display: 'grid', gap: 5 }}>
        <SectionCard
          title="Team members"
          description={members.data ? `${items.length}${members.hasNextPage ? '+' : ''} ${items.length === 1 ? 'member' : 'members'}` : undefined}
          disablePadding
        >
          {members.isError && !members.data ? (
            <Box sx={{ p: 5 }}>
              <ApiErrorAlert
                error={members.error}
                title="Couldn’t load members"
                action={
                  <Button color="inherit" size="small" onClick={() => void members.refetch()}>
                    Retry
                  </Button>
                }
              />
            </Box>
          ) : (
            <TableContainer>
              <Table aria-label="Team members">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Joined</TableCell>
                    <TableCell align="right" sx={{ width: 56 }}>
                      <Box component="span" sx={visuallyHidden}>
                        Actions
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.isPending ? (
                    <TableSkeleton cols={5} />
                  ) : (
                    items.map((member) => {
                      const isSelf = member.userId === myId;
                      const actions = actionsFor(myRole, member, isSelf);
                      return (
                        <TableRow key={member.userId} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
                              <Avatar sx={{ width: 30, height: 30 }} aria-hidden>
                                {initials(member.name)}
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography component="div" sx={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                                  {member.name}
                                  {isSelf ? <Chip label="You" size="small" variant="outlined" sx={{ height: 18, fontSize: 11 }} /> : null}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" noWrap sx={{ display: { xs: 'block', md: 'none' } }}>
                                  {member.email}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary' }}>{member.email}</TableCell>
                          <TableCell>
                            <RoleChip role={member.role} />
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {formatDate(member.joinedAt)}
                          </TableCell>
                          <TableCell align="right">
                            <RowActions
                              member={member}
                              actions={actions}
                              onSelect={(kind) => setDialog(kind === 'leave' ? { kind } : { kind, member })}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {members.hasNextPage ? (
            <Box sx={{ p: 3, borderTop: 1, borderColor: 'divider', textAlign: 'center' }}>
              <Button variant="outlined" color="neutral" size="small" onClick={() => void members.fetchNextPage()} loading={members.isFetchingNextPage}>
                Load more members
              </Button>
            </Box>
          ) : null}
        </SectionCard>

        {canInvite ? (
          <SectionCard title="Pending invitations" description="Invitations that haven’t been accepted yet." disablePadding>
            {invitations.isError ? (
              <Box sx={{ p: 5 }}>
                <ApiErrorAlert error={invitations.error} title="Couldn’t load invitations" />
              </Box>
            ) : !invitations.isPending && invitations.data.length === 0 ? (
              <EmptyState
                compact
                icon={<MarkEmailUnreadOutlined />}
                title="No pending invitations"
                description="Invite teammates by email. They’ll appear here until they join."
                action={
                  <Button variant="outlined" color="neutral" size="small" startIcon={<PersonAddAltOutlined />} onClick={() => setInviteOpen(true)}>
                    Invite member
                  </Button>
                }
              />
            ) : (
              <TableContainer>
                <Table aria-label="Pending invitations">
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Invited by</TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Expires</TableCell>
                      <TableCell align="right">
                        <Box component="span" sx={visuallyHidden}>
                          Actions
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invitations.isPending ? (
                      <TableSkeleton rows={2} cols={5} />
                    ) : (
                      invitations.data.map((inv) => (
                        <TableRow key={inv.id} hover>
                          <TableCell sx={{ fontWeight: 500, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.email}</TableCell>
                          <TableCell>
                            <RoleChip role={inv.role} />
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary' }}>
                            {inv.invitedBy?.name ?? 'Former member'}
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {formatDate(inv.expiresAt)}
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="text"
                              color="error"
                              onClick={() => setDialog({ kind: 'revoke', invitation: inv })}
                              aria-label={`Revoke invitation for ${inv.email}`}
                            >
                              Revoke
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </SectionCard>
        ) : null}
      </Box>

      {canInvite ? <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} orgId={org.id} actorRole={myRole} /> : null}

      {dialog?.kind === 'role' ? (
        <ChangeRoleDialog
          member={dialog.member}
          orgId={org.id}
          roles={roles}
          isSelf={dialog.member.userId === myId}
          onClose={closeDialog}
        />
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === 'remove'}
        title={dialog?.kind === 'remove' ? `Remove ${dialog.member.name}?` : 'Remove member?'}
        description={
          dialog?.kind === 'remove'
            ? `${dialog.member.name} (${dialog.member.email}) will lose access to ${org.name} immediately. You can invite them again later.`
            : undefined
        }
        confirmLabel="Remove member"
        destructive
        loading={removeMember.isPending}
        error={removeMember.error}
        errorTitle={memberErrorTitle(removeMember.error)}
        onClose={closeDialog}
        onConfirm={() => {
          if (dialog?.kind !== 'remove') return;
          const { member } = dialog;
          removeMember.mutate(member.userId, {
            onSuccess: () => {
              notify(`${member.name} was removed from ${org.name}`);
              closeDialog();
            },
          });
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'leave'}
        title={`Leave ${org.name}?`}
        description="You’ll lose access to this organization right away. To come back, someone will need to invite you again."
        confirmLabel="Leave organization"
        destructive
        loading={leave.isPending}
        error={leave.error}
        errorTitle={memberErrorTitle(leave.error)}
        onClose={closeDialog}
        onConfirm={() =>
          leave.mutate(myId, {
            onSuccess: () => {
              clearLastOrgId(org.id);
              notify(`You left ${org.name}`);
              void navigate('/', { replace: true });
              queryClient.removeQueries({ queryKey: queryKeys.org(org.id) });
              void queryClient.invalidateQueries({ queryKey: queryKeys.myOrganizations });
            },
          })
        }
      />

      <ConfirmDialog
        open={dialog?.kind === 'revoke'}
        title="Revoke invitation?"
        description={
          dialog?.kind === 'revoke' ? `The invitation link sent to ${dialog.invitation.email} will stop working.` : undefined
        }
        confirmLabel="Revoke invitation"
        destructive
        loading={revoke.isPending}
        error={revoke.error}
        errorTitle={memberErrorTitle(revoke.error)}
        onClose={closeDialog}
        onConfirm={() => {
          if (dialog?.kind !== 'revoke') return;
          const { invitation } = dialog;
          revoke.mutate(invitation.id, {
            onSuccess: () => {
              notify(`Invitation for ${invitation.email} revoked`);
              closeDialog();
            },
          });
        }}
      />
    </>
  );
}


export default MembersPage;
