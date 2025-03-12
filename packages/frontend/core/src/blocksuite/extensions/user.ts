import type { PublicUserService } from '@affine/core/modules/cloud';
import { UserServiceExtension } from '@blocksuite/affine/shared/services';

export function patchUserExtensions(publicUserService: PublicUserService) {
  return UserServiceExtension({
    // eslint-disable-next-line rxjs/finnish
    userInfo$(id) {
      return publicUserService.publicUser$(id).signal;
    },
    revalidateUserInfo(id) {
      publicUserService.revalidate(id);
    },
  });
}
