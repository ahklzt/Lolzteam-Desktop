
import { useInfiniteQuery } from "@tanstack/react-query";

export const CONVERSATIONS_PAGE_SIZE = 20;

export const useConversationsInfinite = () =>
  useInfiniteQuery({
    queryKey: ["profile", "conversationsInfinite"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      window.moderator.profile.getConversations(pageParam as number),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.ok) return undefined;
      if (lastPage.hasMore) return allPages.length + 1;
      return undefined;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
