import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, usersApi } from "@/lib/api";
import type { User, InsertUser } from "@shared/schema";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Check for stored auth state on mount
    const storedToken = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("auth_user");
    
    if (storedToken && storedUser) {
      try {
        setAuthState({
          user: JSON.parse(storedUser),
          token: storedToken,
          isAuthenticated: true,
        });
      } catch (error) {
        // Clear invalid stored data
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
      }
    }
  }, []);

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login(username, password),
    onSuccess: (data) => {
      const newAuthState = {
        user: data.user,
        token: data.token,
        isAuthenticated: true,
      };
      
      setAuthState(newAuthState);
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
    },
  });

  const logout = () => {
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  };

  return {
    ...authState,
    login: loginMutation.mutate,
    logout,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
  };
}

export function useUsers() {
  return useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: usersApi.getAll,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (user: InsertUser) => usersApi.create(user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ userId, currentPassword, newPassword }: {
      userId: number;
      currentPassword: string;
      newPassword: string;
    }) => usersApi.changePassword(userId, currentPassword, newPassword),
  });
}
