import { ErrorInfo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ButtonPlain } from "@/components/buttons/Button";
import { Icons } from "@/components/Icon";
import { IconPill } from "@/components/layout/IconPill";
import { Title } from "@/components/text/Title";
import { Paragraph } from "@/components/utils/Text";
import { ErrorContainer, ErrorLayout } from "@/pages/layouts/ErrorLayout";
import { ErrorCardInPlainModal } from "@/pages/parts/errors/ErrorCard";
import { errorMessage } from "@/utils/errorDebugInfo";

export function ErrorPart(props: { error: unknown; errorInfo?: ErrorInfo }) {
  const { t } = useTranslation();
  const [showErrorCard, setShowErrorCard] = useState(false);

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <div className="flex h-full flex-1 flex-col items-center justify-center p-5 text-center">
        <ErrorLayout>
          <ErrorContainer maxWidth="max-w-2xl w-9/10">
            <IconPill icon={Icons.EYE_SLASH}>{t("errors.badge")}</IconPill>
            <Title>{t("errors.title")}</Title>

            <Paragraph>{errorMessage(props.error)}</Paragraph>
            <p className="mt-3 text-sm text-type-secondary">
              Try reloading the page, or return to the library to open the
              content again.
            </p>
            <ErrorCardInPlainModal
              show={showErrorCard}
              onClose={() => setShowErrorCard(false)}
              error={props.error}
              componentStack={props.errorInfo?.componentStack ?? undefined}
            />

            <div className="flex flex-wrap justify-center gap-3">
              <ButtonPlain
                theme="secondary"
                className="tabbable mt-6 p-2.5 md:px-8"
                onClick={() => window.location.assign("/")}
              >
                Go to library
              </ButtonPlain>
              <ButtonPlain
                theme="secondary"
                className="tabbable mt-6 p-2.5 md:px-8"
                onClick={() => window.location.reload()}
              >
                {t("errors.reloadPage")}
              </ButtonPlain>
              <ButtonPlain
                theme="purple"
                className="tabbable mt-6 p-2.5 md:px-8"
                onClick={() => setShowErrorCard(true)}
              >
                {t("errors.showError")}
              </ButtonPlain>
            </div>
          </ErrorContainer>
        </ErrorLayout>
      </div>
    </div>
  );
}
