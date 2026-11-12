import { useMutation, useQueryClient } from '@tanstack/react-query';

import { muboxFetch } from '/@/renderer/features/mubox/api/client';
import { muboxKeys } from '/@/renderer/features/mubox/api/mubox-api';

/** POST /users: the password (made up when none was given) is returned this once, mubox does not keep it. */
export interface MuboxNewUser {
    id: string;
    password: string;
    username: string;
}

/** One row of GET /users (Navidrome's accounts). */
export interface MuboxUser {
    admin: boolean;
    id: string;
    last_seen: null | string;
    name: string;
    username: string;
}

const usersKey = [...muboxKeys.all, 'users'] as const;

export const muboxUserQueries = {
    list: () => ({
        queryFn: ({ signal }: { signal?: AbortSignal }) =>
            muboxFetch<MuboxUser[]>('/users', { signal }),
        queryKey: usersKey,
        retry: false,
    }),
};

export const useCreateUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: { password?: string; username: string }) =>
            muboxFetch<MuboxNewUser>('/users', { body, method: 'POST' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
    });
};
