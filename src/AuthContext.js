import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Attempt to get the initial auth state from sessionStorage
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return sessionStorage.getItem('isAuthenticated') === 'true';
    });

    // Hardcoded credentials from environment variables (as requested)
    // In a real app, this would be a call to a backend API.
    const correctUsername = process.env.REACT_APP_USERNAME || 'jcwxt';
    const correctPassword = process.env.REACT_APP_PASSWORD || 'jcw123456!#!';

    useEffect(() => {
        // Persist auth state to sessionStorage
        sessionStorage.setItem('isAuthenticated', isAuthenticated);
    }, [isAuthenticated]);

    const login = (username, password) => {
        if (username === correctUsername && password === correctPassword) {
            setIsAuthenticated(true);
            return true;
        }
        return false;
    };

    const logout = () => {
        setIsAuthenticated(false);
        sessionStorage.removeItem('isAuthenticated');
    };

    const value = {
        isAuthenticated,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};