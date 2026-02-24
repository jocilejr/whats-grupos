import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SelectedGroup {
  id: string;
  user_id: string;
  group_id: string;
  group_name: string | null;
  instance_name: string | null;
  created_at: string;
}

export function useSelectedGroups() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: selectedGroups = [], isLoading } = useQuery({
    queryKey: ["user-selected-groups", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_selected_groups" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("group_name", { ascending: true }) as any;
      if (error) throw error;
      return (data ?? []) as SelectedGroup[];
    },
    enabled: !!user,
  });

  const selectedGroupIds = new Set(selectedGroups.map((g) => g.group_id));

  const replaceAllMutation = useMutation({
    mutationFn: async (groups: { group_id: string; group_name: string; instance_name: string }[]) => {
      // Delete all existing
      await (supabase
        .from("user_selected_groups" as any)
        .delete()
        .eq("user_id", user!.id) as any);

      if (groups.length === 0) return;

      // Insert new
      const rows = groups.map((g) => ({
        user_id: user!.id,
        group_id: g.group_id,
        group_name: g.group_name,
        instance_name: g.instance_name,
      }));

      const { error } = await (supabase
        .from("user_selected_groups" as any)
        .insert(rows) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-selected-groups"] });
    },
  });

  return {
    selectedGroups,
    selectedGroupIds,
    isLoading,
    replaceAll: replaceAllMutation.mutateAsync,
    isReplacing: replaceAllMutation.isPending,
  };
}
