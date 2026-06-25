import fs from 'node:fs/promises';
import bodyParser from 'body-parser';
import express from 'express';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


app.use(bodyParser.json());
app.use(express.static('public'));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-Requested-With, content-type, X-Username, X-UserId' 
  );
  next();
});

try {
  await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
} catch (err) {
  console.log('Data folder already exists or error:', err);
}



// ============= ROUTES FOR AUTHENTICATION =============

// Signup - User Registration with firstName and lastName
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { firstName, lastName, username, email, password } = req.body;

    if (!firstName || !lastName || !username || !email || !password) {
      return res.status(400).json({ 
        message: 'All fields (firstName, lastName, username, email, password) are required.' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters long.' 
      });
    }

    if (username.length < 3) {
      return res.status(400).json({ 
        message: 'Username must be at least 3 characters long.' 
      });
    }

    if (firstName.length < 2 || lastName.length < 2) {
      return res.status(400).json({ 
        message: 'First name and last name must be at least 2 characters long.' 
      });
    }

    let users = [];
    try {
      const usersFileContent = await fs.readFile('./data/users.json');
      users = JSON.parse(usersFileContent);
    } catch (error) {
      users = [];
    }

    const existingUser = users.find(
      (user) => user.email === email || user.username === username
    );

    if (existingUser) {
      return res.status(400).json({ 
        message: 'Email or username already exists.' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: Date.now().toString(),
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await fs.writeFile('./data/users.json', JSON.stringify(users, null, 2));

    res.status(201).json({
      message: 'User created successfully.',
      user: {
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        fullName: newUser.fullName,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: 'Internal server error.' 
    });
  }
});

// Login - User Authentication
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required.' 
      });
    }

    let users = [];
    try {
      const usersFileContent = await fs.readFile('./data/users.json');
      users = JSON.parse(usersFileContent);
    } catch (error) {
      return res.status(401).json({ 
        message: 'Invalid email or password.' 
      });
    }

    const user = users.find((u) => u.email === email);
    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid email or password.' 
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        message: 'Invalid email or password.' 
      });
    }

    res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: 'Internal server error.' 
    });
  }
});

// Get user by ID
app.get('/api/auth/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const usersFileContent = await fs.readFile('./data/users.json');
    const users = JSON.parse(usersFileContent);
    
    const user = users.find((u) => u.id === id);
    
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found.' 
      });
    }
    
    res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Internal server error.' 
    });
  }
});

// ============= EVENT ROUTES WITH USERNAME (بدون محدودیت دسترسی) =============

// Get all events (✅ نمایش همه رویدادها + username سازنده)
app.get('/events', async (req, res) => {
  const { max, search } = req.query;
  const eventsFileContent = await fs.readFile('./data/events.json');
  let events = JSON.parse(eventsFileContent);

  if (search) {
    events = events.filter((event) => {
      const searchableText = `${event.title} ${event.description} ${event.location}`;
      return searchableText.toLowerCase().includes(search.toLowerCase());
    });
  }

  if (max) {
    events = events.slice(events.length - max, events.length);
  }

  res.json({
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      image: event.image,
      date: event.date,
      location: event.location,
      username: event.username || 'unknown',    
      createdAt: event.createdAt || null,        
    })),
  });
});

app.get('/events/images', async (req, res) => {
  const imagesFileContent = await fs.readFile('./data/images.json');
  const images = JSON.parse(imagesFileContent);

  res.json({ images });
});

app.get('/events/:id', async (req, res) => {
  const { id } = req.params;

  const eventsFileContent = await fs.readFile('./data/events.json');
  const events = JSON.parse(eventsFileContent);

  const event = events.find((event) => event.id === id);

  if (!event) {
    return res
      .status(404)
      .json({ message: `For the id ${id}, no event could be found.` });
  }

  setTimeout(() => {
    res.json({ 
      event: {
        ...event,
        username: event.username || 'unknown',  // ✅ نمایش username سازنده
      }
    });
  }, 1000);
});

app.post('/events', async (req, res) => {
  const { event } = req.body;
  
  const username = req.headers['x-username'];
  const userId = req.headers['x-userid'];

  if (!event) {
    return res.status(400).json({ message: 'Event is required' });
  }

  console.log('Creating event:', event);
  console.log('Creator username:', username);
  console.log('Creator userId:', userId);

  if (
    !event.title?.trim() ||
    !event.description?.trim() ||
    !event.date?.trim() ||
    !event.time?.trim() ||
    !event.image?.trim() ||
    !event.location?.trim()
  ) {
    return res.status(400).json({ message: 'Invalid data provided.' });
  }

  const eventsFileContent = await fs.readFile('./data/events.json');
  const events = JSON.parse(eventsFileContent);

  const newEvent = {
    id: Math.round(Math.random() * 10000).toString(),
    ...event,
    username: username || 'anonymous',    
    createdBy: userId || null,             
    createdAt: new Date().toISOString(),   
  };

  events.push(newEvent);
  await fs.writeFile('./data/events.json', JSON.stringify(events, null, 2));

  res.json({ event: newEvent });
});

app.put('/events/:id', async (req, res) => {
  const { id } = req.params;
  const { event } = req.body;
  
  const username = req.headers['x-username'];

  if (!username) {
    return res.status(401).json({ message: 'You must be logged in to edit an event.' });
  }

  if (!event) {
    return res.status(400).json({ message: 'Event is required' });
  }

  if (
    !event.title?.trim() ||
    !event.description?.trim() ||
    !event.date?.trim() ||
    !event.time?.trim() ||
    !event.image?.trim() ||
    !event.location?.trim()
  ) {
    return res.status(400).json({ message: 'Invalid data provided.' });
  }

  const eventsFileContent = await fs.readFile('./data/events.json');
  const events = JSON.parse(eventsFileContent);

  const eventIndex = events.findIndex((event) => event.id === id);

  if (eventIndex === -1) {
    return res.status(404).json({ message: 'Event not found' });
  }

  // ✅ بررسی مالکیت: فقط سازنده رویداد می‌تواند ویرایش کند
  if (events[eventIndex].username !== username) {
    return res.status(403).json({ 
      message: 'You do not have permission to edit this event. Only the creator can edit it.' 
    });
  }

  events[eventIndex] = {
    id: events[eventIndex].id,
    username: events[eventIndex].username,      
    createdBy: events[eventIndex].createdBy,    
    createdAt: events[eventIndex].createdAt,    
    ...event,
    updatedAt: new Date().toISOString(),      
  };

  await fs.writeFile('./data/events.json', JSON.stringify(events, null, 2));

  setTimeout(() => {
    res.json({ event: events[eventIndex] });
  }, 1000);
});

// Delete event - ✅ بدون محدودیت (همه می‌توانند حذف کنند)
// Delete event - ✅ فقط سازنده می‌تواند حذف کند
app.delete('/events/:id', async (req, res) => {
  const { id } = req.params;
  
  // ✅ دریافت username از هدر (کاربر لاگین شده)
  const username = req.headers['x-username'];

  if (!username) {
    return res.status(401).json({ message: 'You must be logged in to delete an event.' });
  }

  const eventsFileContent = await fs.readFile('./data/events.json');
  const events = JSON.parse(eventsFileContent);

  const eventIndex = events.findIndex((event) => event.id === id);

  if (eventIndex === -1) {
    return res.status(404).json({ message: 'Event not found' });
  }

  if (events[eventIndex].username !== username) {
    return res.status(403).json({ 
      message: 'You do not have permission to delete this event. Only the creator can delete it.' 
    });
  }

  events.splice(eventIndex, 1);
  await fs.writeFile('./data/events.json', JSON.stringify(events, null, 2));

  setTimeout(() => {
    res.json({ message: 'Event deleted successfully' });
  }, 1000);
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});