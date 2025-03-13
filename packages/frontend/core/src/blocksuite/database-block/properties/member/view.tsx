import { Avatar, notify, Popover, uniReactRoot } from '@affine/component';
import { Input } from '@affine/component/ui/input';
import {
  type Cell,
  type CellRenderProps,
  createIcon,
  type DataViewCellLifeCycle,
  HostContextKey,
} from '@blocksuite/affine/blocks/database';
import {
  type ExistedUserInfo,
  UserListProvider,
  type UserListService,
  UserProvider,
  type UserService,
} from '@blocksuite/affine/shared/services';
import { computed, type ReadonlySignal } from '@preact/signals-core';
import { generateFractionalIndexingKeyBetween } from '@toeverything/infra';
import type { ForwardRefRenderFunction, MouseEvent, ReactNode } from 'react';
import { forwardRef, useImperativeHandle, useMemo } from 'react';

import { useSignalValue } from '../../../../modules/doc-info/utils';
import type { Member } from '../../../../modules/permissions/entities/members';
import type {
  MemberCellJsonValueType,
  MemberCellRawValueType,
  MemberItemType,
} from './define';
import { memberPropertyModelConfig } from './define';
import * as styles from './style.css';

class MemberManager {
  private readonly cell: Cell<
    MemberCellRawValueType,
    MemberCellJsonValueType,
    {}
  >;
  readonly selectCurrentCell: (editing: boolean) => void;
  readonly isEditing: ReadonlySignal<boolean>;
  public readonly userService?: UserService | null;
  public readonly userListService?: UserListService | null;

  doneMembers = computed(() => this.cell.value$.value ?? {});

  get readonly() {
    return this.cell.property.readonly$;
  }

  constructor(
    props: CellRenderProps<{}, MemberCellRawValueType, MemberCellJsonValueType>
  ) {
    this.cell = props.cell;
    this.selectCurrentCell = props.selectCurrentCell;
    this.isEditing = props.isEditing$;
    const host = this.cell.view.contextGet(HostContextKey);
    this.userService = host?.std.getOptional(UserProvider);
    this.userListService = host?.std.getOptional(UserListProvider);
  }

  removeMember = (member: MemberItemType, e?: MouseEvent): void => {
    e?.stopPropagation();

    const value = { ...this.cell.value$.value };
    delete value[member.id];
    this.cell.valueSet(value);
  };

  addMember = (member: Member): void => {
    if (this.doneMembers.value[member.id]) {
      notify.error({
        title: 'Member already exists',
        message: 'The member has already been added',
      });
      return;
    }

    const lastMember = this.memberList.value[this.memberList.value.length - 1];
    const order = generateFractionalIndexingKeyBetween(
      lastMember?.order || null,
      null
    );

    this.cell.valueSet({
      ...this.cell.value$.value,
      [member.id]: {
        id: member.id,
        order,
      },
    });
  };

  memberList = computed(() => {
    return Object.values(this.doneMembers.value).sort((a, b) =>
      a.order > b.order ? 1 : -1
    );
  });
}

const MemberSearch = ({
  userListService,
}: {
  userListService: UserListService;
}) => {
  const memberList = useSignalValue(userListService.users$);
  const isLoading = useSignalValue(userListService.isLoading$);
  const text = useSignalValue(userListService.searchText$);
  return (
    <div className={styles.memberPopoverContainer}>
      <div className={styles.searchContainer}>
        <Input
          className={styles.searchInput}
          placeholder="Search members..."
          value={text}
          onChange={text => {
            userListService.search(text);
          }}
        />
      </div>
      <div className={styles.memberListContainer}>
        {isLoading ? (
          <div className={styles.loadingContainer}>Loading...</div>
        ) : text && memberList.length === 0 ? (
          <div className={styles.noResultContainer}>No results found</div>
        ) : (
          memberList.map(member => {
            if (member.removed) {
              return null;
            }
            return <MemberListItem key={member.id} member={member} />;
          })
        )}
      </div>
    </div>
  );
};

const MemberCellComponent: ForwardRefRenderFunction<
  DataViewCellLifeCycle,
  CellRenderProps<{}, MemberCellRawValueType, MemberCellJsonValueType>
> = (props, ref): ReactNode => {
  const manager = useMemo(() => new MemberManager(props), []);

  useImperativeHandle(
    ref,
    () => ({
      beforeEnterEditMode: () => {
        return true;
      },
      beforeExitEditingMode: () => {},
      afterEnterEditingMode: () => {},
      focusCell: () => true,
      blurCell: () => true,
      forceUpdate: () => {},
    }),
    []
  );

  const memberList = useSignalValue(manager.memberList);
  const isEditing = useSignalValue(manager.isEditing);

  const renderPopoverContent = () => {
    if (!manager.userService || !manager.userListService) {
      return (
        <div className={styles.memberPopoverContainer}>
          member list only works in cloud
        </div>
      );
    }
    return <MemberSearch userListService={manager.userListService} />;
  };

  return (
    <div style={{ overflow: 'hidden' }}>
      <Popover
        open={isEditing}
        onOpenChange={open => {
          manager.selectCurrentCell(open);
        }}
        contentOptions={{
          className: styles.memberPopoverContent,
        }}
        content={renderPopoverContent()}
      >
        <div></div>
      </Popover>
      <div className={styles.cellContainer}>
        {memberList.map(member => (
          <MemberPreview
            key={member.id}
            member={member}
            memberManager={manager}
          />
        ))}
      </div>
    </div>
  );
};

const useMemberInfo = (id: string, memberManager: MemberManager) => {
  const userInfo = useSignalValue(memberManager.userService?.userInfo$(id));
  if (userInfo && !userInfo.removed) {
    return userInfo;
  }
  return null;
};

export const MemberListItem = (props: { member: ExistedUserInfo }) => {
  const { member } = props;

  return (
    <div className={styles.memberItem}>
      <div className={styles.memberItemContent}>
        <div
          className={styles.avatar}
          style={{ width: `16px`, height: `16px` }}
        >
          <Avatar url={member.avatar} size={16} />
        </div>
        <div className={styles.memberName}>{member.name}</div>
      </div>
    </div>
  );
};

const MemberPreview = ({
  member,
  memberManager,
}: {
  member: MemberItemType;
  memberManager: MemberManager;
}) => {
  const userInfo = useMemberInfo(member.id, memberManager);
  if (!userInfo) {
    return null;
  }
  return (
    <div className={styles.memberPreviewContainer}>
      {userInfo.avatar && (
        <img
          src={userInfo.avatar ?? undefined}
          alt={userInfo.name ?? 'Unnamed'}
          className={styles.avatarImage}
        />
      )}
      <div className={styles.memberName}>{userInfo.name ?? 'Unnamed'}</div>
    </div>
  );
};

const MemberCell = forwardRef(MemberCellComponent);

export const memberPropertyConfig =
  memberPropertyModelConfig.createPropertyMeta({
    icon: createIcon('MultiPeopleIcon'),
    cellRenderer: {
      view: uniReactRoot.createUniComponent(MemberCell),
    },
  });
