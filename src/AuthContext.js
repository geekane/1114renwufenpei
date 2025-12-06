import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Attempt to get the initial auth state from sessionStorage
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return sessionStorage.getItem('isAuthenticated') === 'true';
    });
    
    const [userRole, setUserRole] = useState(() => {
        return sessionStorage.getItem('userRole') || 'guest';
    });

    // Hardcoded credentials from environment variables (as requested)
    // In a real app, this would be a call to a backend API.
    const correctUsername = process.env.REACT_APP_USERNAME || 'jcwxt';
    const correctPassword = process.env.REACT_APP_PASSWORD || 'jcw123456!#!';
    
    // Read-only user credentials
    const readonlyUsername = 'view';
    const readonlyPassword = '123';

    useEffect(() => {
        // Persist auth state to sessionStorage
        sessionStorage.setItem('isAuthenticated', isAuthenticated);
        sessionStorage.setItem('userRole', userRole);
    }, [isAuthenticated, userRole]);

    const login = (username, password) => {
        if (username === correctUsername && password === correctPassword) {
            setIsAuthenticated(true);
            setUserRole('admin');
            return true;
        }
        if (username === readonlyUsername && password === readonlyPassword) {
            setIsAuthenticated(true);
            setUserRole('readonly');
            return true;
        }
        return false;
    };

    const logout = () => {
        setIsAuthenticated(false);
        setUserRole('guest');
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('userRole');
    };

    const value = {
        isAuthenticated,
        userRole, // Export role
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
