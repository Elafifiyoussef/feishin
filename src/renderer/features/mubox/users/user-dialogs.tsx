import { closeModal, openModal } from '@mantine/modals';
import i18n from 'i18next';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getMuboxErrorMessage, isMuboxError } from '/@/renderer/features/mubox/api/client';
import '/@/renderer/features/mubox/i18n/register';
import {
    MuboxNewUser,
    MuboxUser,
    useDeleteUser,
    useUpdateUser,
} from '/@/renderer/features/mubox/users/users-api';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { ConfirmModal } from '/@/shared/components/modal/modal';
import { Stack } from '/@/shared/components/stack/stack';
import { Switch } from '/@/shared/components/switch/switch';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';

interface DialogOptions {
    /** A password was set or made up: show it once. */
    onPassword: (user: MuboxNewUser) => void;
    user: MuboxUser;
}

const EditUserBody = ({ modalId, onPassword, user }: DialogOptions & { modalId: string }) => {
    const { t } = useTranslation();
    const update = useUpdateUser();
    const [username, setUsername] = useState(user.username);
    const [admin, setAdmin] = useState(user.admin);
    const [password, setPassword] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, unknown>>({});

    const send = async (changes: Parameters<typeof update.mutateAsync>[0]['changes']) => {
        setFieldErrors({});
        try {
            const result = await update.mutateAsync({ changes, id: user.id });
            if (result.password) {
                onPassword({ id: result.id, password: result.password, username: result.username });
            } else {
                toast.success({ message: t('mubox.users.saved', { username: result.username }) });
            }
            closeModal(modalId);
        } catch (error) {
            if (isMuboxError(error) && error.fields) setFieldErrors(error.fields);
            else toast.error({ message: getMuboxErrorMessage(error) });
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const changes: Parameters<typeof send>[0] = {};
        if (username.trim() !== user.username) changes.username = username.trim();
        if (admin !== user.admin) changes.admin = admin;
        if (password) changes.password = password;
        if (Object.keys(changes).length === 0) return closeModal(modalId);
        return send(changes);
    };

    const fieldError = (key: string) => (fieldErrors[key] ? String(fieldErrors[key]) : undefined);

    return (
        <form onSubmit={submit}>
            <Stack gap="md">
                <TextInput
                    autoComplete="off"
                    data-autofocus
                    error={fieldError('username')}
                    label={t('mubox.users.username')}
                    onChange={(event) => setUsername(event.currentTarget.value)}
                    value={username}
                />
                <Switch
                    checked={admin}
                    description={user.you ? t('mubox.users.adminSelf') : undefined}
                    disabled={user.you}
                    label={t('mubox.users.admin')}
                    onChange={(event) => setAdmin(event.currentTarget.checked)}
                />
                {fieldError('admin') && (
                    <Text size="sm" style={{ color: 'var(--theme-colors-state-error)' }}>
                        {fieldError('admin')}
                    </Text>
                )}
                <TextInput
                    autoComplete="new-password"
                    description={t('mubox.users.newPasswordHint')}
                    error={fieldError('password')}
                    label={t('mubox.users.newPassword')}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    placeholder={t('mubox.users.keepPassword')}
                    value={password}
                />
                <Group justify="space-between">
                    <Button
                        disabled={update.isPending}
                        leftSection={<Icon icon="refresh" />}
                        onClick={() => send({ reset_password: true })}
                        variant="default"
                    >
                        {t('mubox.users.resetPassword')}
                    </Button>
                    <Group>
                        <Button
                            disabled={update.isPending}
                            onClick={() => closeModal(modalId)}
                            variant="default"
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button loading={update.isPending} type="submit" variant="filled">
                            {t('mubox.users.save')}
                        </Button>
                    </Group>
                </Group>
            </Stack>
        </form>
    );
};

const DeleteUserBody = ({ modalId, user }: { modalId: string; user: MuboxUser }) => {
    const { t } = useTranslation();
    const remove = useDeleteUser();

    const run = async () => {
        try {
            await remove.mutateAsync(user.id);
            toast.success({ message: t('mubox.users.deleted', { username: user.username }) });
            closeModal(modalId);
        } catch (error) {
            toast.error({ message: getMuboxErrorMessage(error) });
        }
    };

    return (
        <ConfirmModal
            labels={{ cancel: t('common.cancel'), confirm: t('mubox.users.delete') }}
            loading={remove.isPending}
            onCancel={() => closeModal(modalId)}
            onConfirm={run}
        >
            <Text>{t('mubox.users.deleteBody', { username: user.username })}</Text>
        </ConfirmModal>
    );
};

let counter = 0;

export function openDeleteUserDialog(user: MuboxUser) {
    const modalId = `mubox-user-delete-${(counter += 1)}`;
    openModal({
        children: <DeleteUserBody modalId={modalId} user={user} />,
        closeOnClickOutside: false,
        modalId,
        title: i18n.t('mubox.users.deleteTitle', { username: user.username }),
    });
}

export function openEditUserDialog(options: DialogOptions) {
    const modalId = `mubox-user-edit-${(counter += 1)}`;
    openModal({
        children: <EditUserBody modalId={modalId} {...options} />,
        closeOnClickOutside: false,
        modalId,
        title: i18n.t('mubox.users.editTitle', { username: options.user.username }),
    });
}
