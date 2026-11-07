import { ReactNode } from 'react';

import { Center } from '/@/shared/components/center/center';
import { AppIconSelection, Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';

interface LuboxStateMessageProps {
    action?: ReactNode;
    description?: string;
    icon: AppIconSelection;
    title: string;
}

/** Centered icon + title + one action, the shared empty/error/no-access pattern of the lubox pages. */
export const LuboxStateMessage = ({ action, description, icon, title }: LuboxStateMessageProps) => {
    return (
        <Center h="100%" p="xl" w="100%">
            <Stack align="center" gap="md" maw="28rem" ta="center">
                <Icon color="muted" icon={icon} size="4xl" />
                <Text size="lg" weight={600}>
                    {title}
                </Text>
                {description && (
                    <Text isMuted size="sm">
                        {description}
                    </Text>
                )}
                {action}
            </Stack>
        </Center>
    );
};
