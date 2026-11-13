import LockOutlined from '@mui/icons-material/LockOutlined';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import { Link as RouterLink } from 'react-router';
import { EmptyState } from './EmptyState';

export function NoAccess({ orgId, what }: { orgId: string; what: string }) {
  return (
    <Card>
      <EmptyState
        icon={<LockOutlined />}
        title="You don’t have access to this page"
        description={`Your role doesn’t include ${what}. Ask an owner or admin if you need it.`}
        action={
          <Button component={RouterLink} to={`/o/${orgId}`} variant="outlined" color="neutral">
            Back to overview
          </Button>
        }
      />
    </Card>
  );
}
