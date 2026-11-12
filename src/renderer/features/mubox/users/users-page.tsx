import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getMuboxErrorMessage, isMuboxError } from '/@/renderer/features/mubox/api/client';
import { MuboxPage } from '/@/renderer/features/mubox/components/mubox-page';
import { MuboxStateMessage } from '/@/renderer/features/mubox/components/mubox-state-message';
import { getMuboxApiBase } from '/@/renderer/features/mubox/constants';
import { useMuboxAccess } from '/@/renderer/features/mubox/hooks/use-mubox-access';
import {
    MuboxNewUser,
    muboxUserQueries,
    useCreateUser,
} from '/@/renderer/features/mubox/users/users-api';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';

/** Where a friend points their app: the server address without the /mubox part. */
const serverAddress = () => {
    const base = getMuboxApiBase();
    const absolute = base.startsWith('http') ? base : `${window.location.origin}${base}`;
    return absolute.replace(/\/mubox$/, '');
};

const CreateUserForm = () => {
    const { t } = useTranslation();
    const create = useCreateUser();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [created, setCreated] = useState<MuboxNewUser | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, unknown>>({});

    const submit = async () => {
        setFieldErrors({});
        try {
            const user = await create.mutateAsync({
                password: password || undefined,
                username: username.trim(),
            });
            setCreated(user);
            setUsername('');
            setPassword('');
        } catch (error) {
            if (isMuboxError(error) && error.fields) setFieldErrors(error.fields);
            else toast.error({ message: getMuboxErrorMessage(error) });
        }
    };

    const handover = created
        ? t('mubox.users.handover', {
              address: serverAddress(),
              password: created.password,
              username: created.username,
          })
        : '';

    return (
        <Stack gap="md" maw="32rem" p="md">
            <Text fw={500} variant="secondary">
                {t('mubox.users.add')}
            </Text>
            <TextInput
                error={fieldErrors.username ? String(fieldErrors.username) : undefined}
                label={t('mubox.users.username')}
                onChange={(event) => setUsername(event.currentTarget.value)}
                value={username}
            />
            <TextInput
                description={t('mubox.users.passwordHint')}
                error={fieldErrors.password ? String(fieldErrors.password) : undefined}
                label={t('mubox.users.password')}
                onChange={(event) => setPassword(event.currentTarget.value)}
                value={password}
            />
            <Group>
                <Button
                    disabled={!username.trim()}
                    loading={create.isPending}
                    onClick={submit}
                    variant="filled"
                >
                    {t('mubox.users.create')}
                </Button>
            </Group>
            {created && (
                <Stack gap="xs">
                    <Text fw={500}>{t('mubox.users.created', { username: created.username })}</Text>
                    <Text isMuted size="sm">
                        {t('mubox.users.shownOnce')}
                    </Text>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{handover}</pre>
                    <Group>
                        <Button
                            leftSection={<Icon icon="clipboardCopy" />}
                            onClick={() => {
                                navigator.clipboard
                                    ?.writeText(handover)
                                    .then(() =>
                                        toast.success({ message: t('mubox.users.copied') }),
                                    );
                            }}
                            variant="default"
                        >
                            {t('mubox.users.copy')}
                        </Button>
                    </Group>
                </Stack>
            )}
        </Stack>
    );
};

/** Friends' accounts: the admin makes a Navidrome account without opening Navidrome (ADR-0013). */
export const UsersPage = () => {
    const { t } = useTranslation();
    const { isAdmin } = useMuboxAccess();
    const query = useQuery({ ...muboxUserQueries.list(), enabled: isAdmin });

    let list;
    if (query.isLoading) {
        list = <Spinner container />;
    } else if (query.isError) {
        list = (
            <MuboxStateMessage
                action={
                    <Button
                        leftSection={<Icon icon="refresh" />}
                        onClick={() => query.refetch()}
                        variant="default"
                    >
                        {t('mubox.status.retry')}
                    </Button>
                }
                description={getMuboxErrorMessage(query.error)}
                icon="wifiOff"
                title={t('mubox.status.unreachable')}
            />
        );
    } else {
        list = (
            <Stack gap="xs" p="md">
                {query.data?.map((user) => (
                    <Group justify="space-between" key={user.id}>
                        <Text>{user.username}</Text>
                        <Text isMuted size="sm">
                            {user.admin ? t('mubox.users.admin') : ''}
                        </Text>
                    </Group>
                ))}
            </Stack>
        );
    }

    return (
        <MuboxPage adminOnly count={query.data?.length} title={t('mubox.pages.users.title')}>
            <CreateUserForm />
            {list}
        </MuboxPage>
    );
};
