import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { luboxFetch } from '/@/renderer/features/lubox/api/client';
import {
    CheckResponse,
    DownloadItem,
    DownloadResponse,
    Job,
    JobsResponse,
    PauseState,
} from '/@/renderer/features/lubox/api/types';

/** Query keys for lubox data. Prefixed so they never collide with Feishin's server-scoped keys. */
export const luboxKeys = {
    all: ['lubox'] as const,
    jobs: () => [...luboxKeys.all, 'jobs'] as const,
};

const ACTIVE_POLL_MS = 3000;

export const luboxQueries = {
    /**
     * GET /jobs. Polls every 3 s while anything is waiting or running, and stops when the queue is
     * idle (a download or retry refetches it).
     */
    jobs: () =>
        queryOptions({
            queryFn: ({ signal }) => luboxFetch<JobsResponse>('/jobs', { signal }),
            queryKey: luboxKeys.jobs(),
            refetchInterval: (query) => {
                const counts = query.state.data?.counts;
                const active = (counts?.queued ?? 0) + (counts?.running ?? 0);
                return active > 0 ? ACTIVE_POLL_MS : false;
            },
            retry: false,
        }),
};

export const useCheckLinks = () =>
    useMutation({
        mutationFn: (text: string) =>
            luboxFetch<CheckResponse>('/check', { body: { text }, method: 'POST' }),
    });

export const useDownload = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (items: DownloadItem[]) =>
            luboxFetch<DownloadResponse>('/download', { body: { items }, method: 'POST' }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: luboxKeys.jobs() }),
    });
};

export const useResumeQueue = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => luboxFetch<{ pause: PauseState }>('/jobs/resume', { method: 'POST' }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: luboxKeys.jobs() }),
    });
};

export const useJobAction = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ action, id }: { action: 'cancel' | 'retry'; id: number }) =>
            luboxFetch<Job>(`/jobs/${id}/${action}`, { method: 'POST' }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: luboxKeys.jobs() }),
    });
};
