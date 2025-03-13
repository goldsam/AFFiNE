import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@affine/admin/components/ui/avatar';
import type { UserType } from '@affine/graphql';
import { FeatureType } from '@affine/graphql';
import type { ColumnDef } from '@tanstack/react-table';
import { cssVarV2 } from '@toeverything/theme/v2';
import clsx from 'clsx';
import {
  LockIcon,
  MailIcon,
  MailWarningIcon,
  UnlockIcon,
  UserIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Checkbox } from '../../../components/ui/checkbox';
import { DataTableColumnHeader } from './data-table-column-header';
import { DataTableRowActions } from './data-table-row-actions';

const StatusItem = ({
  condition,
  IconTrue,
  IconFalse,
  textTrue,
  textFalse,
}: {
  condition: boolean | null;
  IconTrue: ReactNode;
  IconFalse: ReactNode;
  textTrue: string;
  textFalse: string;
}) => (
  <div
    className={clsx(
      'flex gap-2 items-center',
      !condition ? 'text-red-500 opacity-100' : 'opacity-25'
    )}
  >
    {condition ? (
      <>
        {IconTrue}
        {textTrue}
      </>
    ) : (
      <>
        {IconFalse}
        {textFalse}
      </>
    )}
  </div>
);

export const columns: ColumnDef<UserType>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={value => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'info',
    header: ({ column }) => (
      <DataTableColumnHeader className="text-xs" column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <div className="flex gap-4 items-center max-w-[50vw] overflow-hidden">
        <Avatar className="w-10 h-10">
          <AvatarImage src={row.original.avatarUrl ?? undefined} />
          <AvatarFallback>
            <UserIcon size={20} />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1 max-w-full overflow-hidden">
          <div className="text-sm font-medium max-w-full overflow-hidden gap-[6px]">
            <span>{row.original.name}</span>
            {row.original.features.includes(FeatureType.Admin) && (
              <span
                className="ml-2 rounded px-2 py-0.5 text-xs h-5 border"
                style={{
                  borderRadius: '4px',
                  backgroundColor: cssVarV2('chip/label/blue'),
                  borderColor: cssVarV2('layer/insideBorder/border'),
                }}
              >
                Admin
              </span>
            )}
            {row.original.disabled && (
              <span
                className="ml-2 rounded px-2 py-0.5 text-xs h-5 border"
                style={{
                  borderRadius: '4px',
                  backgroundColor: cssVarV2('chip/label/white'),
                  borderColor: cssVarV2('layer/insideBorder/border'),
                }}
              >
                Disabled
              </span>
            )}
          </div>
          <div className="text-xs font-medium opacity-50 max-w-full overflow-hidden">
            {row.original.email}
          </div>
        </div>
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'property',
    header: ({ column }) => (
      <DataTableColumnHeader
        className="text-xs max-md:hidden"
        column={column}
        title="UUID"
      />
    ),
    cell: ({ row: { original: user } }) => (
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-2 text-xs max-md:hidden">
          <div className="flex justify-end opacity-25">{user.id}</div>
          <div className="flex gap-3 items-center justify-end">
            <StatusItem
              condition={user.hasPassword}
              IconTrue={<LockIcon size={10} />}
              IconFalse={<UnlockIcon size={10} />}
              textTrue="Password Set"
              textFalse="No Password"
            />

            <StatusItem
              condition={user.emailVerified}
              IconTrue={<MailIcon size={10} />}
              IconFalse={<MailWarningIcon size={10} />}
              textTrue="Email Verified"
              textFalse="Email Not Verified"
            />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'actions',
    header: ({ column }) => (
      <DataTableColumnHeader
        className="text-xs"
        column={column}
        title="Actions"
      />
    ),
    cell: ({ row: { original: user } }) => <DataTableRowActions user={user} />,
  },
];
