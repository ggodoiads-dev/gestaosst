import { requireUser } from "@/server/auth/current-user";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { RicoChat } from "./rico-chat";

export default async function RicoPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        title="Rico"
        description="Seu assistente de IA — pergunte sobre os dados do sistema ou peça pra ele agir por você."
      />
      <PageBody>
        <RicoChat userFirstName={user.name.split(" ")[0]} />
      </PageBody>
    </>
  );
}
