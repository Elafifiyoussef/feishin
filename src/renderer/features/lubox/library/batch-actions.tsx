import { useTranslation } from 'react-i18next';

import { BatchActionKey } from '/@/renderer/features/lubox/lib/batch';
import { Button } from '/@/shared/components/button/button';
import { DropdownMenu } from '/@/shared/components/dropdown-menu/dropdown-menu';
import { Icon } from '/@/shared/components/icon/icon';

interface BatchActionsProps {
    disabled: boolean;
    onAction: (key: BatchActionKey) => void;
}

/** The actions in the selection bar. They need a selection; each one opens a preview first. */
export const BatchActions = ({ disabled, onAction }: BatchActionsProps) => {
    const { t } = useTranslation();

    return (
        <>
            <DropdownMenu position="top-end">
                <DropdownMenu.Target>
                    <Button
                        disabled={disabled}
                        rightSection={<Icon icon="arrowUpS" />}
                        size="compact-md"
                        variant="default"
                    >
                        {t('lubox.batch.actions.album')}
                    </Button>
                </DropdownMenu.Target>
                <DropdownMenu.Dropdown>
                    <DropdownMenu.Item onClick={() => onAction('album')}>
                        {t('lubox.batch.actions.albumSet')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onClick={() => onAction('playlist')}>
                        {t('lubox.batch.actions.albumFromPlaylist')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onClick={() => onAction('single')}>
                        {t('lubox.batch.actions.albumSingle')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onClick={() => onAction('clear')}>
                        {t('lubox.batch.actions.albumClear')}
                    </DropdownMenu.Item>
                </DropdownMenu.Dropdown>
            </DropdownMenu>
            <Button
                disabled={disabled}
                onClick={() => onAction('artist')}
                size="compact-md"
                variant="default"
            >
                {t('lubox.batch.actions.artist')}
            </Button>
            <Button
                disabled={disabled}
                onClick={() => onAction('date')}
                size="compact-md"
                variant="default"
            >
                {t('lubox.batch.actions.date')}
            </Button>
            <Button
                disabled={disabled}
                leftSection={<Icon icon="delete" />}
                onClick={() => onAction('delete')}
                size="compact-md"
                variant="default"
            >
                {t('lubox.batch.actions.trash')}
            </Button>
        </>
    );
};
