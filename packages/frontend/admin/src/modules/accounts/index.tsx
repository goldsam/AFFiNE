import { Header } from '../header';
import { columns } from './components/columns';
import { DataTable } from './components/data-table';
import { useUserList } from './use-user-list';

export function AccountPage() {
  const { users, pagination, setPagination } = useUserList();
  return (
    <div className=" h-screen flex-1 flex-col flex">
      <Header title="Accounts" />

      <DataTable
        data={users}
        // @ts-expect-error do not complains
        columns={columns}
        pagination={pagination}
        onPaginationChange={setPagination}
      />
    </div>
  );
}
export { AccountPage as Component };
