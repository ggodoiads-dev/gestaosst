import { PageHeader, PageBody } from "@/components/domain/page-header";
import { RicoChat } from "./rico-chat";

export default function RicoPage() {
  return (
    <>
      <PageHeader
        title="Rico"
        description="Seu assistente de IA — pergunte sobre os dados do sistema ou peça pra ele agir por você."
      />
      <PageBody>
        <RicoChat />
      </PageBody>
    </>
  );
}
