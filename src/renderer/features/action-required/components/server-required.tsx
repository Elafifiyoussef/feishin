import { closeAllModals, closeModal, openModal } from '@mantine/modals';
import i18n from 'i18next';
import isElectron from 'is-electron';
import { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import styles from '/@/renderer/features/action-required/components/server-required.module.css';
import { isServerLock } from '/@/renderer/features/action-required/utils/window-properties';
import '/@/renderer/features/mubox/i18n/register';
import JellyfinLogo from '/@/renderer/features/servers/assets/jellyfin.png';
import NavidromeLogo from '/@/renderer/features/servers/assets/navidrome.png';
import OpenSubsonicLogo from '/@/renderer/features/servers/assets/opensubsonic.png';
import { AddServerForm } from '/@/renderer/features/servers/components/add-server-form';
import { EditServerForm } from '/@/renderer/features/servers/components/edit-server-form';
import { AppRoute } from '/@/renderer/router/routes';
import { useAuthStoreActions, useCurrentServer, useServerList } from '/@/renderer/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Icon } from '/@/shared/components/icon/icon';
import { ConfirmModal } from '/@/shared/components/modal/modal';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Text } from '/@/shared/components/text/text';
import {
    ServerListItem,
    ServerListItemWithCredential,
    ServerType,
} from '/@/shared/types/domain-types';

const localSettings = isElectron() ? window.api.localSettings : null;

const openAddServerModal = () => {
    openModal({
        children: <AddServerForm onCancel={closeAllModals} />,
        size: 'lg',
        title: i18n.t('mubox.servers.add'),
    });
};

/**
 * No saved servers: the add form on its own. Otherwise the saved servers as cards, with a plus card
 * that opens the same form in a popup (so the page never has to scroll).
 */
export const ServerRequired = () => {
    const serverList = useServerList();

    if (Object.keys(serverList).length > 0) {
        return (
            <ScrollArea>
                <SavedServers />
            </ScrollArea>
        );
    }

    return <AddServerForm onCancel={null} />;
};

const RemoveServerBody = ({ modalId, server }: { modalId: string; server: ServerListItem }) => {
    const { t } = useTranslation();
    const { deleteServer } = useAuthStoreActions();

    return (
        <ConfirmModal
            labels={{ cancel: t('common.cancel'), confirm: t('page.manageServers.removeServer') }}
            onCancel={() => closeModal(modalId)}
            onConfirm={() => {
                deleteServer(server.id);
                localSettings?.passwordRemove(server.id);
                closeModal(modalId);
            }}
        >
            <Text>{t('mubox.servers.removeBody', { name: server.name, url: server.url })}</Text>
        </ConfirmModal>
    );
};

const openRemoveServerModal = (server: ServerListItem) => {
    const modalId = `remove-server-${server.id}`;
    openModal({
        children: <RemoveServerBody modalId={modalId} server={server} />,
        modalId,
        title: i18n.t('page.manageServers.removeServer'),
    });
};

function SavedServers() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const serverList = useServerList();
    const currentServer = useCurrentServer();
    const { setCurrentServer } = useAuthStoreActions();

    const handleSetCurrentServer = (server: ServerListItemWithCredential) => {
        navigate(AppRoute.HOME);
        setCurrentServer(server);
    };

    const handleCredentialsModal = async (server: ServerListItem) => {
        let password: null | string = null;

        try {
            if (localSettings && server.savePassword) {
                password = await localSettings.passwordGet(server.id);
            }
        } catch (error) {
            console.error(error);
        }
        openModal({
            children: server && (
                <EditServerForm
                    isUpdate
                    onCancel={closeAllModals}
                    password={password}
                    server={server}
                />
            ),
            size: 'sm',
            title: t('form.updateServer.title'),
        });
    };

    return (
        <div className={styles.grid}>
            {Object.keys(serverList).map((serverId) => {
                const server = serverList[serverId];
                const isNavidromeExpired =
                    server.type === ServerType.NAVIDROME && !server.ndCredential;
                const isJellyfinExpired = server.type === ServerType.JELLYFIN && !server.credential;
                const isSubsonicExpired = server.type === ServerType.SUBSONIC && !server.credential;
                const isSessionExpired =
                    isNavidromeExpired || isJellyfinExpired || isSubsonicExpired;

                const logo =
                    server.type === ServerType.NAVIDROME
                        ? NavidromeLogo
                        : server.type === ServerType.JELLYFIN
                          ? JellyfinLogo
                          : OpenSubsonicLogo;

                const open = () => {
                    if (!isSessionExpired) return handleSetCurrentServer(server);
                    return handleCredentialsModal(server);
                };

                return (
                    <div
                        className={styles.card}
                        data-current={server.id === currentServer?.id && !isSessionExpired}
                        key={`server-${server.id}`}
                        onClick={open}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                open();
                            }
                        }}
                        role="button"
                        tabIndex={0}
                    >
                        <div className={styles.cardTop}>
                            <img alt="" className={styles.logo} src={logo} />
                            <span className={styles.cardIcons}>
                                {isSessionExpired && <Icon color="muted" icon="lock" />}
                                <ActionIcon
                                    aria-label={t('page.manageServers.removeServer')}
                                    icon="delete"
                                    onClick={(event: MouseEvent) => {
                                        event.stopPropagation();
                                        openRemoveServerModal(server);
                                    }}
                                    size="sm"
                                    tooltip={{ label: t('page.manageServers.removeServer') }}
                                    variant="subtle"
                                />
                            </span>
                        </div>
                        <div className={styles.cardBody}>
                            <span className={styles.cardName}>{server.name}</span>
                            <span className={styles.cardMeta} title={server.url}>
                                {server.url}
                            </span>
                            <span className={styles.cardMeta}>{server.username}</span>
                        </div>
                    </div>
                );
            })}
            {!isServerLock() && (
                <button
                    aria-label={t('mubox.servers.add')}
                    className={styles.addCard}
                    onClick={openAddServerModal}
                    type="button"
                >
                    <Icon icon="add" size="3xl" />
                    <span>{t('mubox.servers.add')}</span>
                </button>
            )}
        </div>
    );
}
