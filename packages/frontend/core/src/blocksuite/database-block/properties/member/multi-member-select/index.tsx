import { Avatar, Input, notify } from '@affine/component';
import {
  type ExistedUserInfo,
  type UserListService,
  type UserService,
} from '@blocksuite/affine/shared/services';
import { computed, type ReadonlySignal } from '@preact/signals-core';
import { type MouseEvent, useEffect, useMemo, useRef } from 'react';

import { useSignalValue } from '../../../../../modules/doc-info/utils';
import * as baseStyles from '../style.css';
import * as styles from './style.css';

type BaseOptions = {
  userService: UserService;
  userListService: UserListService;
  onComplete: () => void;
};

export type MemberManagerOptions =
  | ({
      multiple: true;
      value: ReadonlySignal<string[]>;
      onChange: (value: string[]) => void;
    } & BaseOptions)
  | ({
      multiple: false;
      value: ReadonlySignal<string>;
      onChange: (value?: string) => void;
    } & BaseOptions);

class MemberManager {
  selectedMembers = computed(() => {
    if (this.ops.multiple) {
      return this.ops.value.value;
    }
    return this.ops.value.value ? [this.ops.value.value] : [];
  });

  constructor(private readonly ops: MemberManagerOptions) {}

  get userService() {
    return this.ops.userService;
  }

  get userListService() {
    return this.ops.userListService;
  }

  selectMember = (memberId: string): void => {
    if (this.ops.multiple) {
      if (this.selectedMembers.value.includes(memberId)) {
        notify.error({
          title: 'Member already exists',
          message: 'The member has already been selected',
        });
        return;
      }
      this.ops.onChange([...this.selectedMembers.value, memberId]);
    } else {
      this.ops.onChange(memberId);
    }
  };

  removeMember = (memberId: string, e?: MouseEvent): void => {
    e?.stopPropagation();
    if (this.ops.multiple) {
      this.ops.onChange(this.ops.value.value.filter(id => id !== memberId));
    } else {
      this.ops.onChange(undefined);
    }
  };

  complete = (): void => {
    this.ops.onComplete();
  };
}

export const useMemberInfo = (id: string, memberManager: MemberManager) => {
  useEffect(() => {
    memberManager.userService?.revalidateUserInfo(id);
  }, [id, memberManager.userService]);
  return useSignalValue(memberManager.userService?.userInfo$(id));
};

export const MemberListItem = (props: {
  member: ExistedUserInfo;
  memberManager: MemberManager;
}) => {
  const { member, memberManager } = props;

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    memberManager.selectMember(member.id);
  };

  return (
    <div className={baseStyles.memberItem} onClick={handleClick}>
      <div className={baseStyles.memberItemContent}>
        <div
          className={baseStyles.avatar}
          style={{ width: `16px`, height: `16px` }}
        >
          <Avatar url={member.avatar} size={16} />
        </div>
        <div className={baseStyles.memberName}>{member.name}</div>
      </div>
    </div>
  );
};

export const MemberPreview = ({
  memberId,
  memberManager,
  onDelete,
}: {
  memberId: string;
  memberManager: MemberManager;
  onDelete?: () => void;
}) => {
  const userInfo = useMemberInfo(memberId, memberManager);
  if (!userInfo) {
    return null;
  }
  return (
    <div className={baseStyles.memberPreviewContainer}>
      <Avatar
        className={baseStyles.avatar}
        url={!userInfo.removed ? userInfo.avatar : undefined}
        size={24}
      />
      <div className={baseStyles.memberName}>
        {userInfo.removed ? 'Deleted user' : userInfo.name || 'Unnamed'}
      </div>
      {onDelete && (
        <div className={styles.memberDeleteIcon} onClick={onDelete}>
          ✕
        </div>
      )}
    </div>
  );
};

export const MultiMemberSelect: React.FC<MemberManagerOptions> = props => {
  const inputRef = useRef<HTMLInputElement>(null);
  const memberManager = useMemo(() => new MemberManager(props), []);

  const memberList = useSignalValue(memberManager.userListService.users$);
  const isLoading = useSignalValue(memberManager.userListService.isLoading$);
  const selectedMembers = useSignalValue(memberManager.selectedMembers);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleInputChange = (value: string) => {
    memberManager.userListService.search(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (
      e.key === 'Backspace' &&
      memberManager.userListService.searchText$.value === ''
    ) {
      const lastId = selectedMembers[selectedMembers.length - 1];
      if (lastId) {
        memberManager.removeMember(lastId);
      }
    } else if (e.key === 'Escape') {
      memberManager.complete();
    }
  };

  return (
    <div
      className={styles.multiMemberSelectContainer}
      onClick={() => inputRef.current?.focus()}
    >
      <div className={styles.memberInputContainer}>
        {selectedMembers.map(memberId => (
          <MemberPreview
            key={memberId}
            memberId={memberId}
            memberManager={memberManager}
            onDelete={() => memberManager.removeMember(memberId)}
          />
        ))}
        <Input
          ref={inputRef}
          className={styles.memberSearchInput}
          placeholder="Search members..."
          value={memberManager.userListService.searchText$.value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className={styles.memberListContainer}>
        {isLoading ? (
          <div className={baseStyles.loadingContainer}>Loading...</div>
        ) : memberManager.userListService.searchText$.value &&
          memberList.length === 0 ? (
          <div className={baseStyles.noResultContainer}>No results found</div>
        ) : (
          memberList.map(member => {
            // 确保只处理非删除的成员
            if (member.removed) return null;
            return (
              <MemberListItem
                key={member.id}
                member={member as ExistedUserInfo}
                memberManager={memberManager}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
