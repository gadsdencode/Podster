import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api';
import { useToast } from './use-toast';
import { useNavigate } from 'react-router-dom';

export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      try {
        const { isAuthenticated } = await adminApi.checkAuth();
        setIsAuthenticated(isAuthenticated);
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  // Login function
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      await adminApi.login(username, password);
      setIsAuthenticated(true);
      toast({
        title: "Login Successful",
        description: "You are now logged in as admin",
      });
      return true;
    } catch (error: any) {
      setIsAuthenticated(false);
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Logout function
  const logout = async () => {
    setIsLoading(true);
    try {
      await adminApi.logout();
      setIsAuthenticated(false);
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully",
      });
      navigate('/admin/login');
    } catch (error) {
      toast({
        title: "Logout Failed",
        description: "There was an issue logging out",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
} 