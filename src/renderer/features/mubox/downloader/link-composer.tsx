import { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './downloader.module.css';

import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { Textarea } from '/@/shared/components/textarea/textarea';

interface LinkComposerProps {
    isChecking: boolean;
    onChange: (value: string) => void;
    onCheck: () => void;
    status: string;
    value: string;
}

/** The link box and the Check button (Ctrl/Cmd + Enter also checks). */
export const LinkComposer = ({
    isChecking,
    onChange,
    onCheck,
    status,
    value,
}: LinkComposerProps) => {
    const { t } = useTranslation();

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) onCheck();
    };

    return (
        <section>
            <Textarea
                aria-label={t('mubox.downloader.check.label')}
                autosize
                maxRows={12}
                minRows={4}
                onChange={(event) => onChange(event.currentTarget.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('mubox.downloader.check.placeholder')}
                value={value}
            />
            <div className={styles.composerBar}>
                <span aria-live="polite" className={styles.hint}>
                    {status || t('mubox.downloader.check.hint')}
                </span>
                <Button
                    disabled={!value.trim()}
                    leftSection={<Icon icon="search" />}
                    loading={isChecking}
                    onClick={onCheck}
                    variant="filled"
                >
                    {t('mubox.downloader.check.button')}
                </Button>
            </div>
        </section>
    );
};
