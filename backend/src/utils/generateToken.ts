<<<<<<< HEAD
    import jwt from 'jsonwebtoken';
    import { type Response } from 'express';

    export const generateToken = (userId: string, res: Response) => {
            const token = jwt.sign({ userId: userId }, process.env.JWT_SECRET as string, {
                expiresIn: '30d',  
                algorithm: 'HS512',
            });
            // attach token to httpOnly cookie
            res.cookie('jwt', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                path: '/', // cookie valid for entire site
            });
    }
=======
import jwt from 'jsonwebtoken';
import { type Response } from 'express';

export const generateToken = (userId: string, res: Response) => {
        const token = jwt.sign({ id: userId }, process.env.JWT_SECRET as string, {
            expiresIn: '30d',  
            algorithm: 'HS512',
        });
        // attach token to httpOnly cookie
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            path: '/', // cookie valid for entire site
        });
}
>>>>>>> a77495f626dbe90aaff470650f7e47812e2b1d22
