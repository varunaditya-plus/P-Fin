import { Button } from "@/components/buttons/Button";
import { WideContainer } from "@/components/layout/WideContainer";
import { Heading1 } from "@/components/utils/Text";
import { LetterboxdSettings } from "@/pages/integrations/LetterboxdSettings";
import { SimklSettings } from "@/pages/integrations/SimklSettings";
import { TraktIntegrationSettings } from "@/pages/integrations/TraktIntegrationSettings";
import { SubPageLayout } from "@/pages/layouts/SubPageLayout";

export default function IntegrationSettings() {
  return (
    <SubPageLayout>
      <WideContainer>
        <div className="space-y-12 pb-12">
          <div className="flex flex-wrap justify-between gap-4">
            <Heading1>Integrations</Heading1>
            <Button theme="secondary" href="/settings">
              Back to settings
            </Button>
          </div>
          <SimklSettings />
          <TraktIntegrationSettings />
          <LetterboxdSettings />
        </div>
      </WideContainer>
    </SubPageLayout>
  );
}
