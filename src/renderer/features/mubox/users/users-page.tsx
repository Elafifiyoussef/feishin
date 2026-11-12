import { useQuery } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './users.module.css';

import { getMuboxErrorMessage, isMuboxError } from '/@/renderer/features/mubox/api/client';
import { MuboxPage } from '/@/renderer/features/mubox/components/mubox-page';
import { MuboxStateMessage } from '/@/renderer/features/mubox/components/mubox-state-message';
import { getMuboxApiBase } from '/@/renderer/features/mubox/constants';
import { useMuboxAccess } from '/@/renderer/features/mubox/hooks/use-mubox-access';
import {
    MuboxNewUser,
    MuboxUser,
    muboxUserQueries,
    useCreateUser,
} from '/@/renderer/features/mubox/users/users-api';
import { Badge } from '/@/shared/components/badge/badge';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { toast } from '/@/shared/components/toast/toast';

/** Where a friend points their app: the server address without the /mubox part. */
const serverAddress = () => {
    const base = getMuboxApiBase();
    const absolute = base.startsWith('http') ? base : `${window.location.origin}${base}`;
    return absolute.replace(/\/mubox$/, '');
};

const Handover = ({ onDismiss, user }: { onDismiss: () => void; user: MuboxNewUser }) => {
    const { t } = useTranslation();
    const address = serverAddress();

    const copy = () => {
        const text = t('mubox.users.handover', {
            address,
            password: user.password,
            username: user.username,
        });
        navigator.clipboard
            ?.writeText(text)
            .then(() => toast.success({ message: t('mubox.users.copied') }));
    };

    return (
        <div className={styles.handover} role="status">
            <div className={styles.handoverHead}>
                <span>{t('mubox.users.created', { username: user.username })}</span>
                <Button
                    aria-label={t('mubox.users.dismiss')}
                    onClick={onDismiss}
                    size="compact-sm"
                    variant="subtle"
                >
                    <Icon icon="x" />
                </Button>
            </div>
            <span className={styles.hint}>{t('mubox.users.shownOnce')}</span>
            <dl className={styles.handoverGrid}>
                <dt>{t('mubox.users.server')}</dt>
                <dd>{address}</dd>
                <dt>{t('mubox.users.username')}</dt>
                <dd>{user.username}</dd>
                <dt>{t('mubox.users.password')}</dt>
                <dd className={styles.secret}>{user.password}</dd>
            </dl>
            <div className={styles.handoverActions}>
                <Button leftSection={<Icon icon="clipboardCopy" />} onClick={copy} variant="filled">
                    {t('mubox.users.copy')}
                </Button>
            </div>
        </div>
    );
};

const CreateUserCard = () => {
    const { t } = useTranslation();
    const create = useCreateUser();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [created, setCreated] = useState<MuboxNewUser | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, unknown>>({});

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!username.trim()) return;
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

    return (
        <section className={styles.card}>
            <form className={styles.card} onSubmit={submit} style={{ padding: 0 }}>
                <span className={styles.cardTitle}>{t('mubox.users.add')}</span>
                <div className={styles.formRow}>
                    <TextInput
                        autoComplete="off"
                        className={styles.field}
                        error={fieldErrors.username ? String(fieldErrors.username) : undefined}
                        label={t('mubox.users.username')}
                        onChange={(event) => setUsername(event.currentTarget.value)}
                        placeholder={t('mubox.users.usernamePlaceholder')}
                        value={username}
                        variant="filled"
                    />
                    <TextInput
                        autoComplete="off"
                        className={styles.field}
                        error={fieldErrors.password ? String(fieldErrors.password) : undefined}
                        label={t('mubox.users.password')}
                        onChange={(event) => setPassword(event.currentTarget.value)}
                        placeholder={t('mubox.users.passwordPlaceholder')}
                        value={password}
                        variant="filled"
                    />
                    <Button
                        className={styles.submit}
                        disabled={!username.trim()}
                        leftSection={<Icon icon="add" />}
                        loading={create.isPending}
                        type="submit"
                        variant="filled"
                    >
                        {t('mubox.users.create')}
                    </Button>
                </div>
                <span className={styles.hint}>{t('mubox.users.passwordHint')}</span>
            </form>
            {created && <Handover onDismiss={() => setCreated(null)} user={created} />}
        </section>
    );
};

const formatSeen = (value: null | string, never: string) => {
    if (!value) return never;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return never;
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const UsersTable = ({ users }: { users: MuboxUser[] }) => {
    const { t } = useTranslation();

    return (
        <ul className={styles.list}>
            <li>
                <div className={`${styles.row} ${styles.rowHead}`}>
                    <span>{t('mubox.users.username')}</span>
                    <span>{t('mubox.users.role')}</span>
                    <span className={styles.cellSeen}>{t('mubox.users.lastSeen')}</span>
                </div>
            </li>
            {users.map((user) => (
                <li key={user.id}>
                    <div className={`${styles.row} ${styles.rowBody}`}>
                        <span className={styles.cellName} title={user.username}>
                            {user.username}
                        </span>
                        <span>
                            <Badge variant={user.admin ? 'filled' : 'default'}>
                                {user.admin ? t('mubox.users.admin') : t('mubox.users.user')}
                            </Badge>
                        </span>
                        <span className={styles.cellSeen}>
                            {formatSeen(user.last_seen, t('mubox.users.never'))}
                        </span>
                    </div>
                </li>
            ))}
        </ul>
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
    } else if (!query.data?.length) {
        list = <MuboxStateMessage icon="user" title={t('mubox.users.empty')} />;
    } else {
        list = <UsersTable users={query.data} />;
    }

    return (
        <MuboxPage adminOnly count={query.data?.length} title={t('mubox.pages.users.title')}>
            <div className={styles.page}>
                <CreateUserCard />
                {list}
            </div>
        </MuboxPage>
    );
};
