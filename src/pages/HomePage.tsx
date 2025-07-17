import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useConversation } from '@elevenlabs/react';
import { useConnection } from '../contexts/ConnectionContext';
import { useClientTools } from '../hooks/useClientTools';
import { useWebhook } from '../hooks/useWebhook';
import VoiceOrb from '../components/VoiceOrb';
import StatusIndicators from '../components/StatusIndicators';
import PermissionWarning from '../components/PermissionWarning';
import UserInfoForm from '../components/UserInfoForm';

// Constants for better performance
const CONNECTION_TIMEOUT = 8000;
const RETRY_ATTEMPTS = 3;

interface UserInfo {
  firstName: string;
  lastName: string;
  email: string;
}

const HomePage: React.FC = () => {
  const { isConnected: globalIsConnected, setIsConnected, isSecureConnection, setIsSecureConnection } = useConnection();
  const { get_firstandlastname, get_email, get_info } = useClientTools();
  const { sendToWebhook } = useWebhook();

  // State management with proper typing
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isStartingCall, setIsStartingCall] = useState(false);

  // Store user info in localStorage when it's set
  useEffect(() => {
    if (userInfo) {
      localStorage.setItem('axie_studio_user_info', JSON.stringify(userInfo));
      console.log('💾 User info stored locally:', userInfo);
    }
  }, [userInfo]);

  // Load user info from localStorage on mount
  useEffect(() => {
    const storedUserInfo = localStorage.getItem('axie_studio_user_info');
    if (storedUserInfo) {
      try {
        const parsed = JSON.parse(storedUserInfo);
        setUserInfo(parsed);
        console.log('📂 User info loaded from localStorage:', parsed);
      } catch (error) {
        console.error('❌ Failed to parse stored user info:', error);
        localStorage.removeItem('axie_studio_user_info');
      }
    }
  }, []);

  // Memoized agent ID with validation
  const agentId = useMemo(() => {
    const id = import.meta.env.VITE_AXIE_STUDIO_AGENT_ID || import.meta.env.VITE_ELEVENLABS_AGENT_ID;
    if (!id) {
      console.error('❌ Axie Studio Agent ID missing in environment variables');
      return null;
    }
    console.log('✅ Axie Studio Agent ID loaded securely');
    return id;
  }, []);

  // Enhanced conversation configuration
  const conversation = useConversation({
    clientTools: { get_firstandlastname, get_email, get_info },
    onConnect: useCallback(() => {
      console.log('🔗 Connected to Axie Studio AI Assistant');
      
      setIsConnected(true);
      setIsSecureConnection(true);
      setConnectionAttempts(0);
      setCallStartTime(Date.now());
      setIsStartingCall(false);
      
    }, [setIsConnected, setIsSecureConnection]),
    onDisconnect: useCallback(() => {
      console.log('🔌 Disconnected from Axie Studio AI Assistant');
      setIsConnected(false);
      setIsSecureConnection(false);
      setCallStartTime(null);
      setIsStartingCall(false);
    }, [setIsConnected, setIsSecureConnection]),
    onMessage: useCallback((message) => {
      console.log('💬 Message received:', message);
    }, []),
    onError: useCallback((error) => {
      console.error('❌ Connection error:', error);
      setIsConnected(false);
      setIsSecureConnection(false);
      
      setIsStartingCall(false);
      
      // Auto-retry logic for better reliability
      if (connectionAttempts < RETRY_ATTEMPTS) {
        setTimeout(() => {
          setConnectionAttempts(prev => prev + 1);
          console.log(`🔄 Retrying connection (${connectionAttempts + 1}/${RETRY_ATTEMPTS})`);
        }, 2000);
      }
    }, [connectionAttempts, setIsConnected, setIsSecureConnection])
  });

  // Optimized microphone permission request with better UX
  const requestMicrophonePermission = useCallback(async () => {
    if (isRequestingPermission) return;
    
    setIsRequestingPermission(true);
    console.log('🎤 Requesting microphone permission...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      
      // Immediately stop the stream to free resources
      stream.getTracks().forEach(track => track.stop());
      
      setHasPermission(true);
      console.log('✅ Microphone permission granted');
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      setHasPermission(false);
    } finally {
      setIsRequestingPermission(false);
    }
  }, [isRequestingPermission]);

  // Handle user info form submission
  const handleUserInfoSubmit = useCallback(async (info: UserInfo) => {
    console.log('👤 User info submitted:', info);
    setUserInfo(info);
    setIsStartingCall(true);
    
    // Send to webhook using helper function
    await sendToWebhook({
      first_name: info.firstName,
      last_name: info.lastName,
      email: info.email,
      full_name: `${info.firstName} ${info.lastName}`,
      prompt: 'User submitted information before starting AI call'
    }, 'pre_call_form_submission');
    
    // Check microphone permission first
    if (!hasPermission) {
      await requestMicrophonePermission();
      if (!hasPermission) {
        setIsStartingCall(false);
        return;
      }
    }
    
    // Start the session
    await startSession();
  }, [hasPermission, requestMicrophonePermission, sendToWebhook]);

  // Enhanced session management
  const startSession = useCallback(async () => {
    if (!agentId) {
      console.error('❌ Cannot start session: Axie Studio Agent ID missing');
      setIsStartingCall(false);
      return;
    }

    console.log('🚀 Starting secure session...');
    
    try {
      const sessionPromise = conversation.startSession({
        agentId: agentId,
        connectionType: 'webrtc'
      });

      // Add timeout for connection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Axie Studio connection timeout')), CONNECTION_TIMEOUT);
      });

      await Promise.race([sessionPromise, timeoutPromise]);
      console.log('✅ Axie Studio session started successfully');
      console.log('🔧 Agent can now call get_firstandlastname, get_email, and get_info tools to receive and store user information');
      
    } catch (error) {
      console.error('❌ Failed to start Axie Studio session:', error);
      setIsStartingCall(false);
      
      // Auto-retry on failure
      if (connectionAttempts < RETRY_ATTEMPTS) {
        setConnectionAttempts(prev => prev + 1);
        setTimeout(() => startSession(), 1000);
      }
    }
  }, [agentId, conversation, connectionAttempts]);

  // Optimized session end with cleanup
  const handleEndSession = useCallback(async () => {
    console.log('🛑 Ending Axie Studio session...');
    
    try {
      await conversation.endSession();
      console.log('✅ Axie Studio session ended successfully');
    } catch (error) {
      console.error('❌ Error ending Axie Studio session:', error);
    } finally {
      setIsConnected(false);
      setIsSecureConnection(false);
      setConnectionAttempts(0);
      // Don't clear userInfo - keep it stored locally
      setIsStartingCall(false);
    }
  }, [conversation, setIsConnected, setIsSecureConnection]);

  // Check initial permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      if (navigator.permissions) {
        try {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setHasPermission(result.state === 'granted');
          
          result.addEventListener('change', () => {
            setHasPermission(result.state === 'granted');
          });
        } catch (error) {
          console.warn('⚠️ Could not check microphone permissions:', error);
        }
      }
    };

    checkPermissions();
  }, []);

  // Security check for HTTPS
  useEffect(() => {
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.warn('⚠️ Insecure connection detected. HTTPS recommended for production.');
    }
  }, []);

  // Memoized connection status
  const connectionStatus = useMemo(() => {
    const isConnected = globalIsConnected && conversation.status === 'connected';
    const isConnecting = conversation.status !== 'connected' && conversation.status !== 'disconnected';
    
    return { isConnected, isConnecting };
  }, [globalIsConnected, conversation.status]);

  const { isConnected, isConnecting } = connectionStatus;

  // Show form if user hasn't submitted info yet and not connected
  if (!userInfo && !isConnected && !isStartingCall) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <UserInfoForm 
          onSubmit={handleUserInfoSubmit}
          isSubmitting={isStartingCall}
        />
      </div>
    );
  }

  return (
    <>
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="text-center w-full max-w-lg">
          <VoiceOrb
            isConnected={isConnected}
            isConnecting={isConnecting}
            isRequestingPermission={isRequestingPermission}
            isSpeaking={conversation.isSpeaking}
            hasPermission={hasPermission}
            connectionAttempts={connectionAttempts}
            onCallClick={handleEndSession}
          />

          <StatusIndicators
            isConnected={isConnected}
            isSecureConnection={isSecureConnection}
            isSpeaking={conversation.isSpeaking}
          />

          <PermissionWarning hasPermission={hasPermission} />
        </div>
      </div>
    </>
  );
};

export default HomePage;